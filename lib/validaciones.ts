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
    telefonoAlternativo: z.string().optional(),
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
  telefonoAlternativo: z.string().optional().or(z.literal("")),
  direccion: z.string().optional().or(z.literal("")),
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
  codigoFcf: z
    .string()
    .regex(/^\d*$/, "El Código FCF solo puede contener números")
    .optional()
    .or(z.literal("")),
  categoria: z.string().optional().or(z.literal("")),
  descripcion: z.string().optional().or(z.literal("")),
  urlLiga: z.string().url("URL inválida").optional().or(z.literal("")),
  temporadaId: z.string().min(1, "Temporada obligatoria"),
});

export const horariosEquipoSchema = z
  .array(
    z.object({
      diaSemana: z.number().int().min(1).max(7),
      minutoInicio: z.number().int().min(0).max(1439),
      minutoFin: z.number().int().min(1).max(1440),
    })
  )
  .superRefine((horarios, ctx) => {
    horarios.forEach((horario, index) => {
      if (horario.minutoInicio >= horario.minutoFin) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "La hora de fin debe ser posterior a la hora de inicio",
          path: [index, "minutoFin"],
        });
      }
    });

    for (let dia = 1; dia <= 7; dia++) {
      const intervalos = horarios
        .filter((horario) => horario.diaSemana === dia)
        .sort((a, b) => a.minutoInicio - b.minutoInicio);
      for (let index = 1; index < intervalos.length; index++) {
        if (intervalos[index].minutoInicio < intervalos[index - 1].minutoFin) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Los intervalos de un mismo día no pueden solaparse",
            path: [],
          });
          break;
        }
      }
    }
  });

export const busquedaJugadorSchema = z.object({
  texto: z.string().optional(),
  anioNacimiento: z.string().optional(),
});

export const perfilUsuarioSchema = z.object({
  nombre: z.string().min(2, "El nombre es obligatorio"),
  apellidos: z.string().min(2, "Los apellidos son obligatorios"),
  telefono: z.string().optional().or(z.literal("")),
  telefonoAlternativo: z.string().optional().or(z.literal("")),
});

export const jugadorEditTutorSchema = z.object({
  nombre: z.string().min(2, "El nombre es obligatorio"),
  apellidos: z.string().min(2, "Los apellidos son obligatorios"),
  fechaNacimiento: z.string().refine((val) => !isNaN(Date.parse(val)), "Fecha inválida"),
  dniNie: z.string().optional().or(z.literal("")),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  telefono: z.string().optional().or(z.literal("")),
  telefonoAlternativo: z.string().optional().or(z.literal("")),
  direccion: z.string().optional().or(z.literal("")),
  sexo: z.enum(["MASCULINO", "FEMENINO", "OTRO"]).optional(),
});

export const padreSchema = z
  .object({
    nombre: z.string().min(2, "El nombre es obligatorio"),
    apellidos: z.string().min(2, "Los apellidos son obligatorios"),
    email: z.string().email("Email inválido"),
    telefono: z.string().optional().or(z.literal("")),
    telefonoAlternativo: z.string().optional().or(z.literal("")),
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

export const cambioPasswordAdminSchema = z
  .object({
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

// === RECIBOS ===

export const reciboSchema = z
  .object({
    concepto: z.string().min(2, "El concepto es obligatorio"),
    descripcion: z.string().optional().or(z.literal("")),
    baseImponible: z.coerce.number().nonnegative("La base imponible no puede ser negativa"),
    tipoIva: z.coerce.number().min(0).max(100, "Tipo de IVA inválido"),
    fechaVencimiento: z.string().optional().or(z.literal("")),
    // Modo de asignación: "equipo" o "jugadores"
    modoAsignacion: z.enum(["equipo", "jugadores"]),
    equiposIds: z.array(z.string()).optional().default([]),
    jugadoresIds: z.array(z.string()).optional().default([]),
  })
  .refine(
    (data) => {
      if (data.modoAsignacion === "equipo") return (data.equiposIds?.length ?? 0) > 0;
      return (data.jugadoresIds?.length ?? 0) > 0;
    },
    {
      message: "Selecciona un equipo o al menos un jugador",
      path: ["modoAsignacion"],
    }
  );

export const reciboPagoSchema = z.object({
  metodoPago: z.string().min(1, "Indica el método de pago"),
  fechaPago: z.string().refine((val) => !isNaN(Date.parse(val)), "Fecha inválida"),
  referenciaPago: z.string().optional().or(z.literal("")),
  notasPago: z.string().optional().or(z.literal("")),
});

export const configuracionClubSchema = z.object({
  nombre: z.string().min(2, "El nombre del club es obligatorio"),
  codigoFcf: z
    .string()
    .regex(/^\d*$/, "El Código FCF solo puede contener números")
    .optional()
    .or(z.literal("")),
  colorPrimario: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color principal inválido"),
  nif: z.string().optional().or(z.literal("")),
  direccion: z.string().optional().or(z.literal("")),
  codigoPostal: z.string().optional().or(z.literal("")),
  ciudad: z.string().optional().or(z.literal("")),
  provincia: z.string().optional().or(z.literal("")),
  pais: z.string().optional().or(z.literal("España")),
  telefono: z.string().optional().or(z.literal("")),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  web: z.string().url("URL inválida").optional().or(z.literal("")),
  ivaPorDefecto: z.coerce.number().min(0).max(100),
  prefijoRecibo: z.string().min(1).max(8),
});

export type ReciboInput = z.infer<typeof reciboSchema>;
export type ReciboPagoInput = z.infer<typeof reciboPagoSchema>;
export type ConfiguracionClubInput = z.infer<typeof configuracionClubSchema>;

// === DOCUMENTOS SOLICITADOS ===

export const solicitudDocumentoSchema = z
  .object({
    nombre: z.string().min(2, "El nombre del documento es obligatorio"),
    descripcion: z.string().optional().or(z.literal("")),
    modoAsignacion: z.enum(["equipo", "jugadores"]),
    equiposIds: z.array(z.string()).optional().default([]),
    jugadoresIds: z.array(z.string()).optional().default([]),
  })
  .refine(
    (data) =>
      data.modoAsignacion === "equipo"
        ? (data.equiposIds?.length ?? 0) > 0
        : (data.jugadoresIds?.length ?? 0) > 0,
    {
      message: "Selecciona un equipo o al menos un jugador",
      path: ["modoAsignacion"],
    }
  );

export const rechazoDocumentoSchema = z.object({
  motivo: z.string().trim().min(3, "Indica por qué el documento no es correcto"),
});

export const rechazoPagoSchema = z.object({
  motivo: z.string().trim().min(3, "Indica por qué se rechaza el pago"),
});

export type SolicitudDocumentoInput = z.infer<typeof solicitudDocumentoSchema>;

// === CONSENTIMIENTOS ===

export const consentimientoSchema = z.object({
  titulo: z.string().trim().min(2, "El título es obligatorio"),
  descripcion: z.string().trim().min(10, "La descripción debe tener al menos 10 caracteres"),
});

export type ConsentimientoInput = z.infer<typeof consentimientoSchema>;

// === ENTRENADORES ===

export const ROLES_ENTRENADOR = [
  "ENTRENADOR_PRINCIPAL",
  "ENTRENADOR_AYUDANTE",
  "PREPARADOR_FISICO",
  "COORDINADOR",
] as const;

export const entrenadorSchema = z.object({
  nombre: z.string().trim().min(2, "El nombre es obligatorio"),
  apellidos: z.string().trim().min(2, "Los apellidos son obligatorios"),
  email: z
    .string()
    .email("Email inválido")
    .optional()
    .or(z.literal("")),
  telefono: z.string().optional().or(z.literal("")),
  telefonoAlternativo: z.string().optional().or(z.literal("")),
  observaciones: z.string().optional().or(z.literal("")),
  // Vinculación opcional a cuentas / fichas existentes
  usuarioId: z.string().optional().or(z.literal("")),
  jugadorId: z.string().optional().or(z.literal("")),
});

export type EntrenadorInput = z.infer<typeof entrenadorSchema>;

// === WIZARD UNIFICADO DE USUARIO ===

export const ROLES_USUARIO = ["ADMIN", "USUARIO"] as const;

export const FLAGS_ROL_USUARIO = [
  "esPadre",
  "esJugador",
  "esEntrenador",
] as const;

export const wizardUsuarioSchema = z
  .object({
    nombre: z.string().trim().min(2, "El nombre es obligatorio"),
    apellidos: z.string().trim().min(2, "Los apellidos son obligatorios"),
    email: z
      .string()
      .trim()
      .optional()
      .or(z.literal(""))
      .refine(
        (v) => !v || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v),
        "Email inválido"
      ),
    fechaNacimiento: z.string().optional().or(z.literal("")),
    dniNie: z.string().optional().or(z.literal("")),
    telefono: z.string().optional().or(z.literal("")),
    telefonoAlternativo: z.string().optional().or(z.literal("")),
    rol: z.enum(ROLES_USUARIO),
    emailVerificado: z.boolean().optional(),

    // Roles funcionales (se aplican opcionalmente)
    esPadre: z.boolean().optional().default(false),
    esJugador: z.boolean().optional().default(false),
    esEntrenador: z.boolean().optional().default(false),

    // Si esJugador + crearPerfilJugador → crea ficha de jugador nueva
    crearPerfilJugador: z.boolean().optional().default(true),
    jugadorExistenteId: z.string().optional().or(z.literal("")),

    // IDs de elementos a asignar (multiselect)
    jugadoresACargoIds: z.array(z.string()).optional().default([]),
    equiposComoJugadorIds: z.array(z.string()).optional().default([]),
    equiposComoEntrenadorIds: z.array(z.string()).optional().default([]),
  })
  .refine(
    (data) =>
      !data.esJugador ||
      !data.crearPerfilJugador ||
      (data.fechaNacimiento && !isNaN(Date.parse(data.fechaNacimiento))),
    {
      message: "La fecha de nacimiento es obligatoria para crear la ficha de jugador",
      path: ["fechaNacimiento"],
    }
  );

export type WizardUsuarioInput = z.infer<typeof wizardUsuarioSchema>;
