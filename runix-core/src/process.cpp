#include "runix/process.hpp"
#include "runix/common.hpp"
#include <iostream>
#include <thread>
#include <vector>

#if defined(RUNIX_PLATFORM_WINDOWS)
#include <windows.h>
#else
#include <unistd.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <signal.h>
#include <fcntl.h>
#endif

namespace runix {

RunixProcessEngine& RunixProcessEngine::instance() {
    static RunixProcessEngine eng;
    return eng;
}

void RunixProcessEngine::cancel(std::string_view executionId) {
    auto it = active_pids_.find(std::string(executionId));
    if (it != active_pids_.end()) {
        uint32_t pid = it->second;
#if defined(RUNIX_PLATFORM_WINDOWS)
        HANDLE hProc = OpenProcess(PROCESS_TERMINATE, FALSE, pid);
        if (hProc) {
            TerminateProcess(hProc, 1);
            CloseHandle(hProc);
        }
#else
        kill(-static_cast<pid_t>(pid), SIGKILL);
        kill(static_cast<pid_t>(pid), SIGKILL);
#endif
        active_pids_.erase(it);
    }
}

ProcessResult RunixProcessEngine::execute(
    const ProcessConfig& config,
    std::function<void(const StreamEvent&)> on_event
) {
    ProcessResult res;
    int64_t startT = current_timestamp_ms();

#if defined(RUNIX_PLATFORM_WINDOWS)
    SECURITY_ATTRIBUTES sa;
    sa.nLength = sizeof(SECURITY_ATTRIBUTES);
    sa.bInheritHandle = TRUE;
    sa.lpSecurityDescriptor = NULL;

    HANDLE hOutRead = NULL, hOutWrite = NULL;
    HANDLE hErrRead = NULL, hErrWrite = NULL;
    HANDLE hInRead = NULL, hInWrite = NULL;

    CreatePipe(&hOutRead, &hOutWrite, &sa, 0);
    SetHandleInformation(hOutRead, HANDLE_FLAG_INHERIT, 0);

    CreatePipe(&hErrRead, &hErrWrite, &sa, 0);
    SetHandleInformation(hErrRead, HANDLE_FLAG_INHERIT, 0);

    CreatePipe(&hInRead, &hInWrite, &sa, 0);
    SetHandleInformation(hInWrite, HANDLE_FLAG_INHERIT, 0);

    STARTUPINFOA si;
    ZeroMemory(&si, sizeof(STARTUPINFOA));
    si.cb = sizeof(STARTUPINFOA);
    si.hStdOutput = hOutWrite;
    si.hStdError = hErrWrite;
    si.hStdInput = hInRead;
    si.dwFlags |= STARTF_USESTDHANDLES;

    PROCESS_INFORMATION pi;
    ZeroMemory(&pi, sizeof(PROCESS_INFORMATION));

    // Construct full command string (wrap in cmd.exe /c if shell required or raw)
    std::string cmd = config.command;
    if (!config.args.empty()) {
        for (const auto& a : config.args) {
            cmd += " " + a;
        }
    }

    std::string finalCmd = "cmd.exe /c " + cmd;

    std::vector<char> cmdBuf(finalCmd.begin(), finalCmd.end());
    cmdBuf.push_back('\0');

    const char* cwd = config.workingDirectory.empty() ? NULL : config.workingDirectory.c_str();

    BOOL success = CreateProcessA(
        NULL,
        cmdBuf.data(),
        NULL,
        NULL,
        TRUE,
        CREATE_NO_WINDOW,
        NULL,
        cwd,
        &si,
        &pi
    );

    // Close child ends in parent
    CloseHandle(hOutWrite);
    CloseHandle(hErrWrite);
    CloseHandle(hInRead);

    if (!success) {
        CloseHandle(hOutRead);
        CloseHandle(hErrRead);
        CloseHandle(hInWrite);
        res.exitCode = 1;
        res.errorReason = "Failed to launch process (CreateProcess error " + std::to_string(GetLastError()) + ")";
        if (on_event) {
            StreamEvent ev;
            ev.type = "error";
            ev.message = res.errorReason;
            on_event(ev);
        }
        return res;
    }

    if (!config.executionId.empty()) {
        active_pids_[config.executionId] = pi.dwProcessId;
    }

    // Write stdin if provided
    if (!config.stdinInput.empty()) {
        DWORD written = 0;
        WriteFile(hInWrite, config.stdinInput.data(), static_cast<DWORD>(config.stdinInput.size()), &written, NULL);
    }
    CloseHandle(hInWrite);

    // Read stdout & stderr in background thread
    auto read_pipe = [](HANDLE hPipe, std::string& buffer, std::string type, std::function<void(const StreamEvent&)> on_ev) {
        char buf[1024];
        DWORD bytesRead = 0;
        while (ReadFile(hPipe, buf, sizeof(buf) - 1, &bytesRead, NULL) && bytesRead > 0) {
            buf[bytesRead] = '\0';
            std::string chunk(buf, bytesRead);
            buffer += chunk;
            if (on_ev) {
                StreamEvent ev;
                ev.type = type;
                ev.data = chunk;
                on_ev(ev);
            }
        }
        CloseHandle(hPipe);
    };

    std::thread outThread(read_pipe, hOutRead, std::ref(res.stdoutData), "stdout", on_event);
    std::thread errThread(read_pipe, hErrRead, std::ref(res.stderrData), "stderr", on_event);

    DWORD waitResult = WaitForSingleObject(pi.hProcess, static_cast<DWORD>(config.timeoutMs));
    if (waitResult == WAIT_TIMEOUT) {
        res.timedOut = true;
        TerminateProcess(pi.hProcess, 1);
        if (on_event) {
            StreamEvent ev;
            ev.type = "error";
            ev.message = "Process execution timed out after " + std::to_string(config.timeoutMs) + " ms";
            on_event(ev);
        }
    }

    outThread.join();
    errThread.join();

    DWORD exitCode = 0;
    GetExitCodeProcess(pi.hProcess, &exitCode);
    res.exitCode = static_cast<int>(exitCode);

    CloseHandle(pi.hProcess);
    CloseHandle(pi.hThread);

    if (!config.executionId.empty()) {
        active_pids_.erase(config.executionId);
    }

#else
    // POSIX Implementation
    int outPipe[2];
    int errPipe[2];
    int inPipe[2];

    pipe(outPipe);
    pipe(errPipe);
    pipe(inPipe);

    pid_t pid = fork();
    if (pid == 0) {
        // Child
        close(outPipe[0]);
        close(errPipe[0]);
        close(inPipe[1]);

        dup2(outPipe[1], STDOUT_FILENO);
        dup2(errPipe[1], STDERR_FILENO);
        dup2(inPipe[0], STDIN_FILENO);

        close(outPipe[1]);
        close(errPipe[1]);
        close(inPipe[0]);

        if (!config.workingDirectory.empty()) {
            chdir(config.workingDirectory.c_str());
        }

        std::string cmd = config.command;
        for (const auto& a : config.args) cmd += " " + a;

        execl("/bin/sh", "sh", "-c", cmd.c_str(), (char*)NULL);
        _exit(127);
    }

    // Parent
    close(outPipe[1]);
    close(errPipe[1]);
    close(inPipe[0]);

    if (!config.stdinInput.empty()) {
        write(inPipe[1], config.stdinInput.data(), config.stdinInput.size());
    }
    close(inPipe[1]);

    if (!config.executionId.empty()) {
        active_pids_[config.executionId] = static_cast<uint32_t>(pid);
    }

    char buf[1024];
    ssize_t n;
    while ((n = read(outPipe[0], buf, sizeof(buf) - 1)) > 0) {
        buf[n] = '\0';
        std::string chunk(buf, n);
        res.stdoutData += chunk;
        if (on_event) {
            StreamEvent ev;
            ev.type = "stdout";
            ev.data = chunk;
            on_event(ev);
        }
    }
    close(outPipe[0]);

    while ((n = read(errPipe[0], buf, sizeof(buf) - 1)) > 0) {
        buf[n] = '\0';
        std::string chunk(buf, n);
        res.stderrData += chunk;
        if (on_event) {
            StreamEvent ev;
            ev.type = "stderr";
            ev.data = chunk;
            on_event(ev);
        }
    }
    close(errPipe[0]);

    int status = 0;
    waitpid(pid, &status, 0);
    if (WIFEXITED(status)) {
        res.exitCode = WEXITSTATUS(status);
    } else {
        res.exitCode = 1;
    }

    if (!config.executionId.empty()) {
        active_pids_.erase(config.executionId);
    }
#endif

    res.durationMs = current_timestamp_ms() - startT;

    if (on_event) {
        StreamEvent ev;
        ev.type = "exit";
        ev.exitCode = res.exitCode;
        ev.durationMs = res.durationMs;
        on_event(ev);
    }

    return res;
}

} // namespace runix
