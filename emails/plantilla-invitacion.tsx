import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

interface PlantillaInvitacionProps {
  nombreDestino: string;
  nombreJugador: string;
  tipoInvitacion: "REGISTRO" | "VINCULACION";
  nombreAdmin: string;
  nombreClub: string;
  urlInvitacion: string;
  mensaje?: string | null;
}

export function PlantillaInvitacion({
  nombreDestino,
  nombreJugador,
  tipoInvitacion,
  nombreAdmin,
  nombreClub,
  urlInvitacion,
  mensaje,
}: PlantillaInvitacionProps) {
  const esRegistro = tipoInvitacion === "REGISTRO";
  const titulo = esRegistro
    ? `Te han invitado a ${nombreClub}`
    : `${nombreJugador} te ha sido asignado`;

  return (
    <Html>
      <Head />
      <Preview>{titulo}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section>
            <Text style={heading}>{titulo}</Text>
            <Text style={paragraph}>Hola {nombreDestino},</Text>
            {esRegistro ? (
              <>
                <Text style={paragraph}>
                  <strong>{nombreAdmin}</strong> te ha invitado a formar parte de{" "}
                  <strong>{nombreClub}</strong> para gestionar la ficha del jugador{" "}
                  <strong>{nombreJugador}</strong>.
                </Text>
                <Text style={paragraph}>
                  Para completar tu registro, haz clic en el siguiente botón y crea tu cuenta con tu
                  propia contraseña:
                </Text>
              </>
            ) : (
              <>
                <Text style={paragraph}>
                  <strong>{nombreAdmin}</strong> ha vinculado al jugador{" "}
                  <strong>{nombreJugador}</strong> a tu cuenta. Si todavía no tienes una cuenta, puedes
                  crearla desde el siguiente enlace. Si ya la tienes, simplemente inicia sesión y el
                  jugador aparecerá automáticamente entre tus jugadores gestionados.
                </Text>
              </>
            )}
            {mensaje && (
              <Section style={mensajeBox}>
                <Text style={paragraph}>
                  <em>"{mensaje}"</em>
                </Text>
              </Section>
            )}
            <Section style={buttonContainer}>
              <Button style={button} href={urlInvitacion}>
                {esRegistro ? "Crear mi cuenta" : "Acceder a mi cuenta"}
              </Button>
            </Section>
            <Text style={small}>
              Si el botón no funciona, copia y pega este enlace en tu navegador:
            </Text>
            <Text style={linkText}>{urlInvitacion}</Text>
            <Hr style={hr} />
            <Text style={footer}>
              Este enlace caduca en 7 días. Si no has solicitado este correo, puedes ignorarlo.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "20px 0 48px",
  marginBottom: "64px",
  maxWidth: "560px",
};

const heading = {
  fontSize: "24px",
  letterSpacing: "-0.5px",
  lineHeight: "1.3",
  fontWeight: "600",
  color: "#484848",
  padding: "17px 0 0",
};

const paragraph = {
  margin: "0 0 15px",
  fontSize: "15px",
  lineHeight: "1.4",
  color: "#3c4149",
};

const mensajeBox = {
  backgroundColor: "#f4f4f5",
  borderLeft: "4px solid #3b82f6",
  padding: "12px 16px",
  margin: "16px 0",
};

const buttonContainer = {
  padding: "27px 0 27px",
};

const button = {
  backgroundColor: "#3b82f6",
  borderRadius: "5px",
  color: "#fff",
  fontSize: "16px",
  fontWeight: "600",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "block",
  padding: "12px 20px",
};

const small = {
  fontSize: "13px",
  color: "#898989",
  marginTop: "20px",
};

const linkText = {
  fontSize: "12px",
  color: "#3b82f6",
  wordBreak: "break-all" as const,
};

const hr = {
  borderColor: "#e6ebf1",
  margin: "20px 0",
};

const footer = {
  color: "#898989",
  fontSize: "12px",
  lineHeight: "1.5",
};

export default PlantillaInvitacion;
