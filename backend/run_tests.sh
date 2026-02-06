#!/bin/bash
./node_modules/.bin/jest tests/unit/rollover.test.js > test_output.txt 2>&1
echo "Done"
