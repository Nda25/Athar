#!/bin/bash
set -euo pipefail
find ../beta -type f -name "*.js" -print0 | xargs -0 sed -i 's/gemini-[0-9.]\+/gemini-2.5-flash/g'
