#!/bin/bash
# Nectar DS CLI - Simple command interface
# Usage: ./nectar-cli.sh <command> [args]

SERVER="http://localhost:9877"

case "$1" in
  status)
    curl -s "$SERVER/status" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Connected: {d[\"connected\"]} | Pending: {d[\"pendingCommands\"]} | Uptime: {int(d[\"uptime\"])}s')"
    ;;
  logs)
    curl -s "$SERVER/logs/${2:-10}"
    ;;
  collections)
    curl -s -X POST "$SERVER/command" -H 'Content-Type: application/json' -d '{"command":"get_variable_collections","payload":{}}' | python3 -m json.tool
    ;;
  variables)
    curl -s -X POST "$SERVER/command" -H 'Content-Type: application/json' -d "{\"command\":\"get_variables\",\"payload\":{\"collectionId\":\"$2\"}}" | python3 -m json.tool
    ;;
  create-var)
    # Usage: create-var <collectionId> <name> <type>
    curl -s -X POST "$SERVER/command" -H 'Content-Type: application/json' \
      -d "{\"command\":\"create_variable\",\"payload\":{\"collectionId\":\"$2\",\"name\":\"$3\",\"resolvedType\":\"$4\"}}"
    echo ""
    ;;
  set-color)
    # Usage: set-color <varId> <modeId> <r> <g> <b>
    curl -s -X POST "$SERVER/command" -H 'Content-Type: application/json' \
      -d "{\"command\":\"set_variable_value\",\"payload\":{\"variableId\":\"$2\",\"modeId\":\"$3\",\"value\":{\"r\":$4,\"g\":$5,\"b\":$6}}}"
    echo ""
    ;;
  set-float)
    # Usage: set-float <varId> <modeId> <value>
    curl -s -X POST "$SERVER/command" -H 'Content-Type: application/json' \
      -d "{\"command\":\"set_variable_value\",\"payload\":{\"variableId\":\"$2\",\"modeId\":\"$3\",\"value\":$4}}"
    echo ""
    ;;
  pm2)
    pm2 "$2" nectar-server
    ;;
  help|*)
    echo "Nectar DS CLI"
    echo "Usage: ./nectar-cli.sh <command> [args]"
    echo ""
    echo "Commands:"
    echo "  status           - Check server connection status"
    echo "  logs [n]         - Show last n logs (default 10)"
    echo "  collections      - List variable collections"
    echo "  variables <id>   - List variables in collection"
    echo "  create-var <col> <name> <type> - Create variable"
    echo "  set-color <var> <mode> <r> <g> <b> - Set color value"
    echo "  set-float <var> <mode> <value> - Set float value"
    echo "  pm2 <cmd>        - PM2 command (start/stop/restart/logs)"
    ;;
esac
