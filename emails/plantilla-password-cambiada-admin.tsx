import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

interface Props {
  nombreDestino: string;
  nombreClub: string;
}

export function PlantillaPasswordCambiadaAdmin({
  nombreDestino,
  nombreClub,
}: Props) {
  return (
    <Html>
      <Head />
      <Preview>Un administrador ha cambiado tu contraseña</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section>
            <Text style={heading}>Tu contraseña ha cambiado</Text>
            <Text style={paragraph}>Hola {nombreDestino},</Text>
            <Text style={paragraph}>
              Un administrador de <strong>{nombreClub}</strong> ha cambiado la contraseña
              de tu cuenta.
            </Text>
            <Text style={paragraph}>
              Por seguridad, la nueva contraseña no se incluye en este correo.
            </Text>
            <Hr style={hr} />
            <Text style={footer}>
              Si no esperabas este cambio, contacta inmediatamente con el club y utiliza
              el proceso de recuperación de contraseña.
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
  padding: "20px 28px 48px",
  marginBottom: "64px",
  maxWidth: "560px",
};

const heading = {
  fontSize: "24px",
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

const hr = {
  borderColor: "#e6ebf1",
  margin: "20px 0",
};

const footer = {
  color: "#898989",
  fontSize: "12px",
  lineHeight: "1.5",
};

export default PlantillaPasswordCambiadaAdmin;
