declare module "@simplewebauthn/server" {
  export type AuthenticatorTransportFuture = "ble" | "cable" | "hybrid" | "internal" | "nfc" | "smart-card" | "usb";

  export interface PublicKeyCredentialCreationOptionsJSON {
    rp: {
      name: string;
      id?: string;
    };
    user: {
      id: string;
      name: string;
      displayName: string;
    };
    challenge: string;
    pubKeyCredParams: Array<{
      type: "public-key";
      alg: number;
    }>;
    timeout?: number;
    excludeCredentials?: Array<{
      id: string;
      type: "public-key";
      transports?: AuthenticatorTransportFuture[];
    }>;
    authenticatorSelection?: {
      authenticatorAttachment?: "platform" | "cross-platform";
      residentKey?: "discouraged" | "preferred" | "required";
      requireResidentKey?: boolean;
      userVerification?: "required" | "preferred" | "discouraged";
    };
    attestation?: "none" | "indirect" | "direct" | "enterprise";
    extensions?: Record<string, unknown>;
  }

  export interface RegistrationResponseJSON {
    id: string;
    rawId: string;
    response: {
      clientDataJSON: string;
      attestationObject: string;
      authenticatorData?: string;
      transports?: AuthenticatorTransportFuture[];
      publicKeyAlgorithm?: number;
      publicKey?: string;
    };
    authenticatorAttachment?: "platform" | "cross-platform";
    clientExtensionResults: Record<string, unknown>;
    type: "public-key";
  }

  export interface GenerateRegistrationOptionsOpts {
    rpName: string;
    rpID: string;
    userID: Uint8Array | string;
    userName: string;
    userDisplayName?: string;
    challenge?: string | Uint8Array;
    timeout?: number;
    attestationType?: "none" | "indirect" | "direct" | "enterprise";
    excludeCredentials?: Array<{
      id: string;
      type?: "public-key";
      transports?: AuthenticatorTransportFuture[];
    }>;
    authenticatorSelection?: {
      authenticatorAttachment?: "platform" | "cross-platform";
      residentKey?: "discouraged" | "preferred" | "required";
      requireResidentKey?: boolean;
      userVerification?: "required" | "preferred" | "discouraged";
    };
    supportedAlgorithmIDs?: number[];
  }

  export interface VerifiedRegistrationResponse {
    verified: boolean;
    registrationInfo?: {
      credential: {
        id: string;
        publicKey: Uint8Array;
        counter: number;
        transports?: AuthenticatorTransportFuture[];
      };
      credentialType?: "public-key";
      attestationObject?: Uint8Array;
      userVerified?: boolean;
      credentialID?: string | Uint8Array;
      credentialPublicKey?: Uint8Array;
      counter?: number;
    };
  }

  export interface VerifyRegistrationResponseOpts {
    response: RegistrationResponseJSON;
    expectedChallenge: string | ((challenge: string) => boolean | Promise<boolean>);
    expectedOrigin: string | string[];
    expectedRPID: string | string[];
    requireUserVerification?: boolean;
  }

  export interface PublicKeyCredentialRequestOptionsJSON {
    challenge: string;
    timeout?: number;
    rpId?: string;
    allowCredentials?: Array<{
      id: string;
      type: "public-key";
      transports?: AuthenticatorTransportFuture[];
    }>;
    userVerification?: "required" | "preferred" | "discouraged";
    extensions?: Record<string, unknown>;
  }

  export interface AuthenticationResponseJSON {
    id: string;
    rawId: string;
    response: {
      clientDataJSON: string;
      authenticatorData: string;
      signature: string;
      userHandle?: string;
    };
    authenticatorAttachment?: "platform" | "cross-platform";
    clientExtensionResults: Record<string, unknown>;
    type: "public-key";
  }

  export interface GenerateAuthenticationOptionsOpts {
    rpID?: string;
    challenge?: string | Uint8Array;
    timeout?: number;
    allowCredentials?: Array<{
      id: string;
      type?: "public-key";
      transports?: AuthenticatorTransportFuture[];
    }>;
    userVerification?: "required" | "preferred" | "discouraged";
  }

  export interface VerifiedAuthenticationResponse {
    verified: boolean;
    authenticationInfo: {
      newCounter: number;
      credentialID?: string | Uint8Array;
      userVerified?: boolean;
      origin?: string;
      rpID?: string;
    };
  }

  export interface VerifyAuthenticationResponseOpts {
    response: AuthenticationResponseJSON;
    expectedChallenge: string | ((challenge: string) => boolean | Promise<boolean>);
    expectedOrigin: string | string[];
    expectedRPID: string | string[];
    credential: {
      id: string;
      publicKey: Uint8Array;
      counter: number;
      transports?: AuthenticatorTransportFuture[];
    };
    requireUserVerification?: boolean;
  }

  export function generateRegistrationOptions(
    opts: GenerateRegistrationOptionsOpts
  ): Promise<PublicKeyCredentialCreationOptionsJSON>;

  export function verifyRegistrationResponse(
    opts: VerifyRegistrationResponseOpts
  ): Promise<VerifiedRegistrationResponse>;

  export function generateAuthenticationOptions(
    opts: GenerateAuthenticationOptionsOpts
  ): Promise<PublicKeyCredentialRequestOptionsJSON>;

  export function verifyAuthenticationResponse(
    opts: VerifyAuthenticationResponseOpts
  ): Promise<VerifiedAuthenticationResponse>;
}
