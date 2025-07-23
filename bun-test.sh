#!/bin/bash

# Load environment variables from .env.local
if [ -f .env.local ]; then
    export $(cat .env.local | grep -v '^#' | xargs)
fi

# Source bash profile to ensure Bun is in PATH
source ~/.bash_profile

# Run Bun test with all arguments passed through
bun test "$@"