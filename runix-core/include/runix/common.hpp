#pragma once

#include <string>
#include <string_view>
#include <vector>
#include <optional>
#include <sstream>
#include <algorithm>
#include <filesystem>
#include <chrono>
#include <cstdint>

#if defined(_WIN32) || defined(__WIN32__) || defined(WIN32)
#define RUNIX_PLATFORM_WINDOWS 1
#elif defined(__APPLE__) || defined(__MACH__)
#define RUNIX_PLATFORM_MACOS 1
#else
#define RUNIX_PLATFORM_LINUX 1
#endif

namespace runix {

namespace fs = std::filesystem;

inline std::string trim(std::string_view s) {
    auto start = s.find_first_not_of(" \t\r\n");
    if (start == std::string_view::npos) return "";
    auto end = s.find_last_not_of(" \t\r\n");
    return std::string(s.substr(start, end - start + 1));
}

inline std::string to_lower(std::string_view s) {
    std::string out(s);
    std::transform(out.begin(), out.end(), out.begin(), [](unsigned char c) {
        return static_cast<char>(std::tolower(c));
    });
    return out;
}

inline bool starts_with(std::string_view str, std::string_view prefix) {
    return str.size() >= prefix.size() && str.substr(0, prefix.size()) == prefix;
}

inline bool ends_with(std::string_view str, std::string_view suffix) {
    return str.size() >= suffix.size() && str.substr(str.size() - suffix.size()) == suffix;
}

inline std::vector<std::string> split(std::string_view s, char delim) {
    std::vector<std::string> tokens;
    std::string token;
    for (char ch : s) {
        if (ch == delim) {
            if (!token.empty()) {
                tokens.push_back(token);
                token.clear();
            }
        } else {
            token += ch;
        }
    }
    if (!token.empty()) tokens.push_back(token);
    return tokens;
}

inline std::string join(const std::vector<std::string>& list, std::string_view sep) {
    std::ostringstream oss;
    for (size_t i = 0; i < list.size(); ++i) {
        if (i > 0) oss << sep;
        oss << list[i];
    }
    return oss.str();
}

inline std::string replace_all(std::string str, std::string_view from, std::string_view to) {
    if (from.empty()) return str;
    size_t start_pos = 0;
    while ((start_pos = str.find(from, start_pos)) != std::string::npos) {
        str.replace(start_pos, from.length(), to);
        start_pos += to.length();
    }
    return str;
}

inline std::string escape_json(std::string_view s) {
    std::ostringstream oss;
    for (char c : s) {
        switch (c) {
            case '"':  oss << "\\\""; break;
            case '\\': oss << "\\\\"; break;
            case '\b': oss << "\\b";  break;
            case '\f': oss << "\\f";  break;
            case '\n': oss << "\\n";  break;
            case '\r': oss << "\\r";  break;
            case '\t': oss << "\\t";  break;
            default:
                if (static_cast<unsigned char>(c) < 0x20) {
                    char buf[8];
                    snprintf(buf, sizeof(buf), "\\u%04x", static_cast<unsigned char>(c));
                    oss << buf;
                } else {
                    oss << c;
                }
                break;
        }
    }
    return oss.str();
}

inline int64_t current_timestamp_ms() {
    using namespace std::chrono;
    return duration_cast<milliseconds>(system_clock::now().time_since_epoch()).count();
}

} // namespace runix
