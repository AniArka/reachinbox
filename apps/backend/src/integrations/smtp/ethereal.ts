import nodemailer from 'nodemailer';
import { env } from '../../config/env';

export interface EtherealCredentials {
  user: string;
  pass: string;
  host: string;
  port: number;
}

export async function getOrCreateEtherealAccount(existingUser?: string, existingPass?: string): Promise<EtherealCredentials> {
  if (existingUser && existingPass) {
    return {
      user: existingUser,
      pass: existingPass,
      host: env.ETHEREAL_HOST,
      port: env.ETHEREAL_PORT,
    };
  }

  // If env credentials provided
  if (env.ETHEREAL_USER && env.ETHEREAL_PASS) {
    return {
      user: env.ETHEREAL_USER,
      pass: env.ETHEREAL_PASS,
      host: env.ETHEREAL_HOST,
      port: env.ETHEREAL_PORT,
    };
  }

  // Automatically provision a live test account from Ethereal
  console.log('📬 Auto-provisioning a fresh Ethereal SMTP test account...');
  const testAccount = await nodemailer.createTestAccount();
  console.log(`✅ Provisioned Ethereal account: ${testAccount.user}`);

  return {
    user: testAccount.user,
    pass: testAccount.pass,
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
  };
}

export function createEtherealTransporter(creds: EtherealCredentials) {
  return nodemailer.createTransport({
    host: creds.host,
    port: creds.port,
    secure: false, // TLS via STARTTLS
    auth: {
      user: creds.user,
      pass: creds.pass,
    },
  });
}
