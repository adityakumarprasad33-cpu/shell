#pragma once

#include "common.hpp"
#include <string>
#include <vector>
#include <map>
#include <memory>
#include <sstream>
#include <stdexcept>
#include <cctype>

namespace runix {

enum class JsonType {
    Null,
    Boolean,
    Number,
    String,
    Array,
    Object
};

class JsonValue {
public:
    JsonType type = JsonType::Null;
    bool bool_val = false;
    double num_val = 0.0;
    std::string str_val;
    std::vector<JsonValue> arr_val;
    std::map<std::string, JsonValue> obj_val;

    JsonValue() : type(JsonType::Null) {}
    JsonValue(std::nullptr_t) : type(JsonType::Null) {}
    JsonValue(bool b) : type(JsonType::Boolean), bool_val(b) {}
    JsonValue(int n) : type(JsonType::Number), num_val(n) {}
    JsonValue(int64_t n) : type(JsonType::Number), num_val(static_cast<double>(n)) {}
    JsonValue(double d) : type(JsonType::Number), num_val(d) {}
    JsonValue(const char* s) : type(JsonType::String), str_val(s ? s : "") {}
    JsonValue(std::string s) : type(JsonType::String), str_val(std::move(s)) {}
    JsonValue(std::string_view s) : type(JsonType::String), str_val(s) {}
    JsonValue(std::vector<JsonValue> a) : type(JsonType::Array), arr_val(std::move(a)) {}
    JsonValue(std::map<std::string, JsonValue> o) : type(JsonType::Object), obj_val(std::move(o)) {}

    static JsonValue object() {
        JsonValue v;
        v.type = JsonType::Object;
        return v;
    }

    static JsonValue array() {
        JsonValue v;
        v.type = JsonType::Array;
        return v;
    }

    bool is_null() const { return type == JsonType::Null; }
    bool is_bool() const { return type == JsonType::Boolean; }
    bool is_number() const { return type == JsonType::Number; }
    bool is_string() const { return type == JsonType::String; }
    bool is_array() const { return type == JsonType::Array; }
    bool is_object() const { return type == JsonType::Object; }

    bool as_bool(bool def = false) const {
        return is_bool() ? bool_val : def;
    }

    int64_t as_int(int64_t def = 0) const {
        return is_number() ? static_cast<int64_t>(num_val) : def;
    }

    double as_double(double def = 0.0) const {
        return is_number() ? num_val : def;
    }

    std::string as_string(std::string_view def = "") const {
        return is_string() ? str_val : std::string(def);
    }

    const std::vector<JsonValue>& as_array() const {
        return arr_val;
    }

    const std::map<std::string, JsonValue>& as_object() const {
        return obj_val;
    }

    bool contains(const std::string& key) const {
        return is_object() && obj_val.find(key) != obj_val.end();
    }

    const JsonValue& operator[](const std::string& key) const {
        static const JsonValue null_val;
        if (!is_object()) return null_val;
        auto it = obj_val.find(key);
        return it != obj_val.end() ? it->second : null_val;
    }

    JsonValue& operator[](const std::string& key) {
        if (!is_object()) {
            type = JsonType::Object;
            obj_val.clear();
        }
        return obj_val[key];
    }

    const JsonValue& operator[](size_t index) const {
        static const JsonValue null_val;
        if (!is_array() || index >= arr_val.size()) return null_val;
        return arr_val[index];
    }

    void push_back(JsonValue val) {
        if (!is_array()) {
            type = JsonType::Array;
            arr_val.clear();
        }
        arr_val.push_back(std::move(val));
    }

    std::string serialize() const {
        std::ostringstream oss;
        switch (type) {
            case JsonType::Null:
                oss << "null";
                break;
            case JsonType::Boolean:
                oss << (bool_val ? "true" : "false");
                break;
            case JsonType::Number:
                if (num_val == static_cast<int64_t>(num_val)) {
                    oss << static_cast<int64_t>(num_val);
                } else {
                    oss << num_val;
                }
                break;
            case JsonType::String:
                oss << "\"" << escape_json(str_val) << "\"";
                break;
            case JsonType::Array: {
                oss << "[";
                for (size_t i = 0; i < arr_val.size(); ++i) {
                    if (i > 0) oss << ",";
                    oss << arr_val[i].serialize();
                }
                oss << "]";
                break;
            }
            case JsonType::Object: {
                oss << "{";
                size_t idx = 0;
                for (const auto& [k, v] : obj_val) {
                    if (idx++ > 0) oss << ",";
                    oss << "\"" << escape_json(k) << "\":" << v.serialize();
                }
                oss << "}";
                break;
            }
        }
        return oss.str();
    }

    static JsonValue parse(std::string_view input) {
        size_t pos = 0;
        skip_ws(input, pos);
        if (pos >= input.size()) return JsonValue();
        return parse_value(input, pos);
    }

private:
    static void skip_ws(std::string_view s, size_t& pos) {
        while (pos < s.size() && (s[pos] == ' ' || s[pos] == '\t' || s[pos] == '\r' || s[pos] == '\n')) {
            ++pos;
        }
    }

    static JsonValue parse_value(std::string_view s, size_t& pos) {
        skip_ws(s, pos);
        if (pos >= s.size()) return JsonValue();

        char c = s[pos];
        if (c == 'n') return parse_literal(s, pos, "null", JsonValue());
        if (c == 't') return parse_literal(s, pos, "true", JsonValue(true));
        if (c == 'f') return parse_literal(s, pos, "false", JsonValue(false));
        if (c == '"') return parse_string(s, pos);
        if (c == '[') return parse_array(s, pos);
        if (c == '{') return parse_object(s, pos);
        if (c == '-' || std::isdigit(static_cast<unsigned char>(c))) return parse_number(s, pos);

        return JsonValue();
    }

    static JsonValue parse_literal(std::string_view s, size_t& pos, std::string_view lit, JsonValue val) {
        if (s.substr(pos, lit.size()) == lit) {
            pos += lit.size();
            return val;
        }
        return JsonValue();
    }

    static JsonValue parse_string(std::string_view s, size_t& pos) {
        ++pos; // skip '"'
        std::string res;
        while (pos < s.size()) {
            char c = s[pos++];
            if (c == '"') {
                return JsonValue(res);
            }
            if (c == '\\' && pos < s.size()) {
                char esc = s[pos++];
                switch (esc) {
                    case '"': res += '"'; break;
                    case '\\': res += '\\'; break;
                    case '/': res += '/'; break;
                    case 'b': res += '\b'; break;
                    case 'f': res += '\f'; break;
                    case 'n': res += '\n'; break;
                    case 'r': res += '\r'; break;
                    case 't': res += '\t'; break;
                    case 'u':
                        if (pos + 4 <= s.size()) {
                            pos += 4; // skip basic unicode hex for simplicity
                            res += '?';
                        }
                        break;
                    default: res += esc; break;
                }
            } else {
                res += c;
            }
        }
        return JsonValue(res);
    }

    static JsonValue parse_number(std::string_view s, size_t& pos) {
        size_t start = pos;
        if (pos < s.size() && s[pos] == '-') ++pos;
        while (pos < s.size() && std::isdigit(static_cast<unsigned char>(s[pos]))) ++pos;
        if (pos < s.size() && s[pos] == '.') {
            ++pos;
            while (pos < s.size() && std::isdigit(static_cast<unsigned char>(s[pos]))) ++pos;
        }
        if (pos < s.size() && (s[pos] == 'e' || s[pos] == 'E')) {
            ++pos;
            if (pos < s.size() && (s[pos] == '+' || s[pos] == '-')) ++pos;
            while (pos < s.size() && std::isdigit(static_cast<unsigned char>(s[pos]))) ++pos;
        }
        std::string num_str(s.substr(start, pos - start));
        try {
            double d = std::stod(num_str);
            return JsonValue(d);
        } catch (...) {
            return JsonValue(0);
        }
    }

    static JsonValue parse_array(std::string_view s, size_t& pos) {
        ++pos; // skip '['
        JsonValue val = JsonValue::array();
        skip_ws(s, pos);
        if (pos < s.size() && s[pos] == ']') {
            ++pos;
            return val;
        }
        while (pos < s.size()) {
            val.push_back(parse_value(s, pos));
            skip_ws(s, pos);
            if (pos < s.size() && s[pos] == ',') {
                ++pos;
                skip_ws(s, pos);
            } else if (pos < s.size() && s[pos] == ']') {
                ++pos;
                break;
            } else {
                break;
            }
        }
        return val;
    }

    static JsonValue parse_object(std::string_view s, size_t& pos) {
        ++pos; // skip '{'
        JsonValue val = JsonValue::object();
        skip_ws(s, pos);
        if (pos < s.size() && s[pos] == '}') {
            ++pos;
            return val;
        }
        while (pos < s.size()) {
            skip_ws(s, pos);
            if (pos >= s.size() || s[pos] != '"') break;
            std::string key = parse_string(s, pos).as_string();
            skip_ws(s, pos);
            if (pos < s.size() && s[pos] == ':') {
                ++pos;
            }
            val[key] = parse_value(s, pos);
            skip_ws(s, pos);
            if (pos < s.size() && s[pos] == ',') {
                ++pos;
                skip_ws(s, pos);
            } else if (pos < s.size() && s[pos] == '}') {
                ++pos;
                break;
            } else {
                break;
            }
        }
        return val;
    }
};

} // namespace runix
