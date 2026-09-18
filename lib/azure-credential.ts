import { DefaultAzureCredential } from "@azure/identity";

let credential: DefaultAzureCredential | null = null;

export function getAzureCredential(): DefaultAzureCredential {
  if (credential) return credential;

  const managedIdentityClientId = process.env.AZURE_MANAGED_IDENTITY_CLIENT_ID?.trim();
  credential = new DefaultAzureCredential(
    managedIdentityClientId ? { managedIdentityClientId } : undefined
  );
  return credential;
}
