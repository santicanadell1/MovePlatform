#!/bin/sh
set -e

# Arranca el servidor Ollama en background
ollama serve &
OLLAMA_PID=$!

# Espera a que la API esté lista
echo "Esperando que Ollama inicie..."
until ollama list > /dev/null 2>&1; do
  sleep 2
done
echo "Ollama listo."

# Descarga el modelo de embeddings si no está presente
if ! ollama list | grep -q "nomic-embed-text"; then
  echo "Descargando nomic-embed-text..."
  ollama pull nomic-embed-text
  echo "nomic-embed-text descargado."
else
  echo "nomic-embed-text ya está presente."
fi

# Descarga el modelo LLM (categorización R10, paso 3 del cascade)
if ! ollama list | grep -q "qwen2.5:3b"; then
  echo "Descargando qwen2.5:3b..."
  ollama pull qwen2.5:3b
  echo "qwen2.5:3b descargado."
else
  echo "qwen2.5:3b ya está presente."
fi

# Espera al proceso principal
wait $OLLAMA_PID
