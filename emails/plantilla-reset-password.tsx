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

interface PlantillaResetPasswordProps {
  nombreDestino: string;
  urlReset: string;
  minutosExpiracion: number;
  nombreClub: string;
}

export function PlantillaResetPassword({
  nombreDestino,
  urlReset,
  minutosExpiracion,
  nombreClub,
}: PlantillaResetPasswordProps) {
  return (
    <Html>
      <Head />
      <Preview>Restablece tu contraseña</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section>
            <Text style={heading}>Restablece tu contraseña</Text>
            <Text style={paragraph}>Hola {nombreDestino},</Text>
            <Text style={paragraph}>
              Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en{" "}
              <strong>{nombreClub}</strong>.
            </Text>
            <Text style={paragraph}>
              Si has sido tú, haz clic en el siguiente botón para crear una nueva contraseña. El
              enlace caducará en {minutosExpiracion} minutos.
            </Text>
            <Section style={buttonContainer}>
              <Button style={button} href={urlReset}>
                Restablecer contraseña
              </Button>
            </Section>
            <Text style={small}>
              Si el botón no funciona, copia y pega este enlace en tu navegador:
            </Text>
            <Text style={linkText}>{urlReset}</Text>
            <Hr style={hr} />
            <Text style={footer}>
              Si no has solicitado este cambio, puedes ignorar este correo. Tu contraseña seguirá
              siendo la misma.
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

export default PlantillaResetPassword;
