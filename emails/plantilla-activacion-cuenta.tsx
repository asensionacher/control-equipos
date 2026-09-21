import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "@react-email/components";

interface PlantillaActivacionCuentaProps {
  nombreDestino: string;
  urlActivacion: string;
  diasExpiracion: number;
  nombreClub: string;
  motivo: "padre" | "jugador" | "admin" | "usuario";
  nombreJugadorVinculado?: string;
  logoUrl?: string;
}

export function PlantillaActivacionCuenta({
  nombreDestino,
  urlActivacion,
  diasExpiracion,
  nombreClub,
  motivo,
  nombreJugadorVinculado,
  logoUrl,
}: PlantillaActivacionCuentaProps) {
  const titulo =
    motivo === "padre"
      ? `Activa tu cuenta de padre / tutor`
      : `Activa tu cuenta de jugador`;

  const textoMotivo =
    motivo === "padre"
      ? `Te han creado una cuenta en ${nombreClub} para gestionar la ficha${
          nombreJugadorVinculado ? ` de ${nombreJugadorVinculado}` : ""
        }.`
      : `Te han creado una cuenta en ${nombreClub} para acceder a tu ficha de jugador.`;

  return (
    <Html>
      <Head />
      <Preview>{titulo}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section>
            {logoUrl && (
              <Section style={logoContainer}>
                <Img src={logoUrl} alt={nombreClub} width="96" style={logo} />
              </Section>
            )}
            <Text style={heading}>{titulo}</Text>
            <Text style={paragraph}>Hola {nombreDestino},</Text>
            <Text style={paragraph}>{textoMotivo}</Text>
            <Text style={paragraph}>
              Para empezar a usarla, haz clic en el siguiente botón y elige una contraseña. El
              enlace caducará en {diasExpiracion} días.
            </Text>
            <Section style={buttonContainer}>
              <Button style={button} href={urlActivacion}>
                Activar mi cuenta
              </Button>
            </Section>
            <Text style={small}>
              Si el botón no funciona, copia y pega este enlace en tu navegador:
            </Text>
            <Text style={linkText}>{urlActivacion}</Text>
            <Hr style={hr} />
            <Text style={footer}>
              Si no esperabas este correo, puedes ignorarlo. La cuenta no se activará hasta que
              no elijas una contraseña.
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

const logoContainer = {
  textAlign: "center" as const,
  padding: "12px 0 4px",
};

const logo = {
  display: "inline-block",
  maxHeight: "96px",
  maxWidth: "120px",
  objectFit: "contain" as const,
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

export default PlantillaActivacionCuenta;
