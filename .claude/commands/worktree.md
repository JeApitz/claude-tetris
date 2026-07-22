---
description: Crea un git worktree aislado en .trees/ y ejecuta ahí las instrucciones dadas, sin tocar el árbol de trabajo principal
argument-hint: <descripción del requerimiento e instrucciones a ejecutar>
---

El usuario pasó este requerimiento/instrucciones a ejecutar en un worktree aislado:

$ARGUMENTS

Sigue estos pasos:

1. **Determina un nombre corto** en kebab-case (2-4 palabras) que describa el requerimiento anterior. Este será tanto el nombre de la carpeta como el de la rama (p.ej. `fix-ghost-piece`, `add-hold-queue`).

2. **Verifica el estado del repo** con `git status` antes de crear nada. Si `.trees/<nombre>` ya existe, elige un nombre alternativo o pregunta al usuario cómo proceder.

3. **Crea el worktree** con una rama nueva a partir de la rama actual:
   ```
   git worktree add .trees/<nombre> -b <nombre>
   ```

4. **Trabaja exclusivamente dentro de `.trees/<nombre>/`** para todo el resto de esta tarea: lecturas, ediciones, comandos de build/test, commits, etc. No modifiques archivos fuera de esa carpeta ni en el checkout principal — el objetivo es aislamiento total del código principal.

5. **Ejecuta las instrucciones del requerimiento** dentro de ese worktree como si fuera un proyecto independiente (mismas reglas de CLAUDE.md aplican).

6. Al terminar, informa brevemente:
   - Ruta del worktree y nombre de la rama creada.
   - Resumen de los cambios hechos.
   - Que el worktree sigue ahí para revisión/merge manual (no hagas merge, push, ni elimines el worktree salvo que el usuario lo pida explícitamente).
