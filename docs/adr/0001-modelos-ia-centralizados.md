# 0001 — IDs de modelos de IA en un solo archivo
- Estado: aceptada
- Fecha: 2026-10-10

## Contexto
Los IDs de modelo vivían repartidos entre cada adaptador, `geminiConfig.ts`, los textos de `config.ts` y las traducciones. Google deprecó parámetros (`temperature`, `thinkingBudget`) y varios modelos, y una prueba contra la API real mostró que `gemini-3.5-flash-lite` rechaza `thinkingBudget` con 400 y `gemini-3.8-flash` rechaza `thinkingLevel: "minimal"`. Además existía un segundo flujo Gemini (`generateGeminiText`) que solo usaban los tests.

## Decisión
- `src/lib/ai/models.ts` es la única fuente de IDs, etiquetas, orden de respaldo y `thinkingLevel` por modelo.
- Cadena Gemini: `gemini-3.5-flash-lite` → `gemini-3.1-flash-lite` → `gemini-3.6-flash` → `gemini-3.8-flash`.
- No se envían `temperature`, `top_p`, `top_k` ni `candidateCount` a Gemini.
- Plazo total de 8 s para la cadena Gemini (6 s por intento); al agotarse, actúa el motor local.
- Se elimina el flujo Gemini duplicado; sus tests de resiliencia pasaron a `geminiAdapter.test.ts`.
- Se retiran de las cadenas los modelos guard de Groq y `gpt-3.5-turbo`.

## Consecuencias
- Una deprecación futura se resuelve editando `models.ts` (y el texto de `modelDescription` en `config.ts` y las traducciones).
- Los IDs y niveles de thinking se verificaron manualmente contra la API el 2026-10-10; la cadena puede quedar desfasada si Google cambia el catálogo, y el fallback local sigue cubriendo cualquier fallo.
- El copy de `modelDescription` sigue escrito a mano: hay que mantenerlo alineado con `models.ts`.
