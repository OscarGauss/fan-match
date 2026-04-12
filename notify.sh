#!/bin/bash

send_webhook() {
    local phase=$1
    local status=$2
    local msg=$3

    curl -s -X POST "$WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -H "x-webhook-token: $WEBHOOK_TOKEN" \
        -d "{
            \"event\": \"${phase}_${status}\",
            \"message\": \"[$phase] $msg\",
            \"source\": \"nixpacks-pipeline\"
        }"
}

PHASE=$1
shift # Elimina el primer argumento (la fase) para dejar el resto como el comando a ejecutar

send_webhook "$PHASE" "START" "Iniciando fase..."

# Ejecutar el comando de la fase
if "$@"; then
    send_webhook "$PHASE" "SUCCESS" "Fase completada con éxito."
else
    EXIT_CODE=$?
    send_webhook "$PHASE" "ERROR" "Error en la fase. Código: $EXIT_CODE"
    exit $EXIT_CODE
fi
