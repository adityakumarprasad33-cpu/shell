export const OFFICIAL_RUNIX_COMMAND_REFERENCE = `======================================================================
RUNIX TERMINAL PLATFORM COMMAND REFERENCE
======================================================================

Welcome to Runix Developer Console.

CORE EXECUTION COMMANDS:
  runix run <file>       Compile & execute any supported file via Runix Execution Engine
  runix build <file>     Execute verified build pipeline for a file or workspace
  runix test <file>      Run test suite for file or workspace
  runix status           Inspect sandbox telemetry, storage, and SLA health
  runix doctor           Verify installed toolchains, compilers, and environments
  runix version          Inspect active release distribution and platform telemetry
  runix download         Navigate to official multi-platform binary distributions

FILESYSTEM COMMANDS:
  ls / dir               List files and folders in active workspace
  ll / la                Detailed long-format directory listing with sizes & timestamps
  cat <file>             Inspect file contents with line numbers
  touch <file>           Create a new empty file in current folder
  mkdir <folder>         Create a new directory
  cp <src> <dest>        Copy a file or directory
  mv <src> <dest>        Move or rename a file or directory
  rm <file>              Remove a file or directory
  clean                  Clean temporary build artifacts

LANGUAGE EXECUTION:
  runix run test.lua     Run Lua script with installed Lua runtime
  runix run main.py      Run Python script with Python runtime
  runix run main.cpp     Compile with GCC/Clang and execute binary
  runix run App.java     Compile with javac and execute with Java
  runix run main.rs      Compile with rustc/cargo and execute binary
  runix run main.go      Run Go program with go run

For comprehensive documentation, visit https://console.runix.in
======================================================================
`;
