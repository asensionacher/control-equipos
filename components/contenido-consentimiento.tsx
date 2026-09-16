import { obtenerContenidoConsentimientoHtml } from "@/lib/consentimiento-contenido";

export function ContenidoConsentimiento({
  contenido,
  className = "",
}: {
  contenido: string;
  className?: string;
}) {
  return (
    <div
      className={`[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mb-3 [&_p:last-child]:mb-0 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6 ${className}`}
      dangerouslySetInnerHTML={{
        __html: obtenerContenidoConsentimientoHtml(contenido),
      }}
    />
  );
}
