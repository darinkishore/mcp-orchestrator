#!/bin/bash
echo "DEBUG: Arguments received:"
echo "Number of args: $#"
for i in $(seq 1 $#); do
    echo "Arg $i: '${!i}'"
done
echo "---"
exec /usr/bin/npx -y @modelcontextprotocol/server-filesystem /tmp