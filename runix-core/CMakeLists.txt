cmake_minimum_required(VERSION 3.20)
project(RunixCore VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Compiler flags
if(MSVC)
    add_compile_options(/W4 /EHsc /O2 /permissive-)
else()
    add_compile_options(-Wall -Wextra -Wpedantic -O2)
endif()

include_directories(include)

set(SOURCES
    src/registry.cpp
    src/detector.cpp
    src/discovery.cpp
    src/capability.cpp
    src/planner.cpp
    src/path_resolver.cpp
    src/sandbox.cpp
    src/process.cpp
    src/builder.cpp
    src/runner.cpp
    src/tests.cpp
)

# 1. Main executable: runix-core
add_executable(runix-core src/main.cpp ${SOURCES})

# 2. Standalone test suite executable: runix-core-tests
add_executable(runix-core-tests src/tests.cpp ${SOURCES})
target_compile_definitions(runix-core-tests PRIVATE RUNIX_STANDALONE_TEST_MAIN=1)
