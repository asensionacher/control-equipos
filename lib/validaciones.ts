import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

export const registroUsuarioSchema = z
  .object({
    nombre: z.string().min(2, "El nombre es obligatorio"),
    apellidos: z.string().min(2, "Los apellidos son obligatorios"),
    email: z.string().email("Email inválido"),
    telefono: z.string().optional(),
    password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
    confirmarPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmarPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmarPassword"],
  });

export const jugadorSchema = z.object({
  nombre: z.string().min(2, "El nombre es obligatorio"),
  apellidos: z.string().min(2, "Los apellidos son obligatorios"),
  fechaNacimiento: z.string().refine(
    (val) => !isNaN(Date.parse(val)),
    "Fecha de nacimiento inválida"
  ),
  dniNie: z.string().optional().or(z.literal("")),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  telefono: z.string().optional().or(z.literal("")),
  direccion: z.string().optional().or(z.literal("")),
  fotoUrl: z.string().url("URL inválida").optional().or(z.literal("")),
  sexo: z.enum(["MASCULINO", "FEMENINO", "OTRO"]).optional(),

  // Tutor seleccionado (opcional). Si se especifica y es nuevo, se crea la cuenta.
  tutorUsuarioId: z.string().optional().or(z.literal("")),
  parentescoTutor: z.string().optional().or(z.literal("")),

  // Si no hay tutor, se pueden guardar datos de contacto del padre sin cuenta
  emailContactoTutor: z.string().email("Email inválido").optional().or(z.literal("")),
  telefonoContactoTutor: z.string().optional().or(z.literal("")),
});

export const temporadaSchema = z
  .object({
    nombre: z.string().min(4, "El nombre es obligatorio (ej. 2026/2027)"),
    fechaInicio: z.string().refine((val) => !isNaN(Date.parse(val)), "Fecha inválida"),
    fechaFin: z.string().refine((val) => !isNaN(Date.parse(val)), "Fecha inválida"),
    activa: z.boolean().default(true),
  })
  .refine(
    (data) => new Date(data.fechaFin) > new Date(data.fechaInicio),
    {
      message: "La fecha de fin debe ser posterior a la fecha de inicio",
      path: ["fechaFin"],
    }
  );

export const equipoSchema = z.object({
  nombre: z.string().min(2, "El nombre del equipo es obligatorio"),
  categoria: z.string().optional().or(z.literal("")),
  descripcion: z.string().optional().or(z.literal("")),
  urlLiga: z.string().url("URL inválida").optional().or(z.literal("")),
  temporadaId: z.string().min(1, "Temporada obligatoria"),
});

export const busquedaJugadorSchema = z.object({
  texto: z.string().optional(),
  anioNacimiento: z.string().optional(),
});

export const perfilUsuarioSchema = z.object({
  nombre: z.string().min(2, "El nombre es obligatorio"),
  apellidos: z.string().min(2, "Los apellidos son obligatorios"),
  telefono: z.string().optional().or(z.literal("")),
});

export const jugadorEditTutorSchema = z.object({
  nombre: z.string().min(2, "El nombre es obligatorio"),
  apellidos: z.string().min(2, "Los apellidos son obligatorios"),
  fechaNacimiento: z.string().refine((val) => !isNaN(Date.parse(val)), "Fecha inválida"),
  dniNie: z.string().optional().or(z.literal("")),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  telefono: z.string().optional().or(z.literal("")),
  direccion: z.string().optional().or(z.literal("")),
  fotoUrl: z.string().url("URL inválida").optional().or(z.literal("")),
  sexo: z.enum(["MASCULINO", "FEMENINO", "OTRO"]).optional(),
});

export const padreSchema = z
  .object({
    nombre: z.string().min(2, "El nombre es obligatorio"),
    apellidos: z.string().min(2, "Los apellidos son obligatorios"),
    email: z.string().email("Email inválido"),
    telefono: z.string().optional().or(z.literal("")),
    password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
    confirmarPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmarPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmarPassword"],
  });

export const cambioPasswordSchema = z
  .object({
    passwordActual: z.string().min(1, "Introduce tu contraseña actual"),
    passwordNueva: z.string().min(8, "La nueva contraseña debe tener al menos 8 caracteres"),
    confirmarPassword: z.string(),
  })
  .refine((data) => data.passwordNueva === data.confirmarPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmarPassword"],
  });

export const recuperarPasswordSchema = z.object({
  email: z.string().email("Email inválido"),
});

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
    confirmarPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmarPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmarPassword"],
  });

export const activarCuentaSchema = z
  .object({
    password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
    confirmarPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmarPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmarPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegistroUsuarioInput = z.infer<typeof registroUsuarioSchema>;
export type JugadorInput = z.infer<typeof jugadorSchema>;
export type TemporadaInput = z.infer<typeof temporadaSchema>;
export type EquipoInput = z.infer<typeof equipoSchema>;
export type BusquedaJugadorInput = z.infer<typeof busquedaJugadorSchema>;
export type PerfilUsuarioInput = z.infer<typeof perfilUsuarioSchema>;
export type JugadorEditTutorInput = z.infer<typeof jugadorEditTutorSchema>;
export type CambioPasswordInput = z.infer<typeof cambioPasswordSchema>;
export type ActivarCuentaInput = z.infer<typeof activarCuentaSchema>;
