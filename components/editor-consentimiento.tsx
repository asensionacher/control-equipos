"use client";

import { useRef, useState } from "react";
import {
  Bold as BoldIcon,
  Italic,
  List,
  ListOrdered,
  Underline,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function EditorConsentimiento() {
  const editorRef = useRef<HTMLDivElement>(null);
  const [contenido, setContenido] = useState("");

  function ejecutarComando(comando: string, valor?: string) {
    editorRef.current?.focus();
    document.execCommand(comando, false, valor);
    setContenido(editorRef.current?.innerHTML ?? "");
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="descripcion-editor">Descripción del consentimiento *</Label>
      <div className="flex flex-wrap items-center gap-1 rounded-t-md border border-b-0 bg-muted/40 p-2">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label="Negrita"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => ejecutarComando("bold")}
        >
          <BoldIcon className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label="Cursiva"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => ejecutarComando("italic")}
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label="Subrayado"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => ejecutarComando("underline")}
        >
          <Underline className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label="Lista con viñetas"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => ejecutarComando("insertUnorderedList")}
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label="Lista numerada"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => ejecutarComando("insertOrderedList")}
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        <select
          aria-label="Tamaño de fuente"
          defaultValue="3"
          className="h-9 rounded-md border bg-background px-2 text-sm"
          onChange={(event) => ejecutarComando("fontSize", event.target.value)}
        >
          <option value="2">Pequeño</option>
          <option value="3">Normal</option>
          <option value="4">Mediano</option>
          <option value="5">Grande</option>
          <option value="6">Muy grande</option>
        </select>
        <label className="ml-1 flex h-9 items-center gap-2 rounded-md border bg-background px-2 text-xs">
          Color
          <input
            type="color"
            defaultValue="#111827"
            className="h-6 w-7 cursor-pointer border-0 bg-transparent p-0"
            onChange={(event) => ejecutarComando("foreColor", event.target.value)}
          />
        </label>
      </div>
      <div
        id="descripcion-editor"
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        data-placeholder="Escribe el texto que deberá aceptar el jugador o tutor..."
        className="min-h-64 rounded-b-md border bg-background p-4 text-sm outline-none empty:before:pointer-events-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)] focus-visible:ring-2 focus-visible:ring-ring"
        onInput={(event) => setContenido(event.currentTarget.innerHTML)}
      />
      <input type="hidden" name="descripcion" value={contenido} />
      <p className="text-xs text-muted-foreground">
        Puedes aplicar negrita, cursiva, subrayado, listas, tamaño y color.
      </p>
    </div>
  );
}
