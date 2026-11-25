import nodemailer from 'nodemailer';
import crypto from 'crypto';
import { env } from '../../config/env';
import { createEtherealTransporter } from './ethereal';

export interface EmailPayload {
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  senderEtherealUser?: string | null;
  senderEtherealPass?: string | null;
}

export interface DeliveryResult {
  messageId: string;
  previewUrl: string | null;
  simulated: boolean;
  provider: 'ethereal_smtp' | 'simulated_delivery';
  metadata?: Record<string, any>;
}

export interface IEmailDeliveryAdapter {
  send(payload: EmailPayload): Promise<DeliveryResult>;
}

/**
 * Standard Ethereal SMTP Adapter (uses port 587).
 * Intended for local development and environments with outbound SMTP access.
 */
export class EtherealSmtpAdapter implements IEmailDeliveryAdapter {
  async send(payload: EmailPayload): Promise<DeliveryResult> {
    const transporter = createEtherealTransporter({
      user: payload.senderEtherealUser || payload.from,
      pass: payload.senderEtherealPass || env.ETHEREAL_PASS,
      host: env.ETHEREAL_HOST,
      port: env.ETHEREAL_PORT,
    });

    const info = await transporter.sendMail({
      from: `"${payload.from}" <${payload.from}>`,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html || `<p>${payload.text.replace(/\n/g, '<br/>')}</p>`,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info) || null;

    return {
      messageId: info.messageId,
      previewUrl,
      simulated: false,
      provider: 'ethereal_smtp',
      metadata: {
        smtpHost: env.ETHEREAL_HOST,
        smtpPort: env.ETHEREAL_PORT,
        response: info.response,
      },
    };
  }
}

/**
 * Demo Simulated Delivery Adapter.
 * Explicitly records simulated delivery events without opening outbound SMTP connections
 * (avoiding port 25/465/587 blocks on Render's free tier).
 */
export class SimulatedDeliveryAdapter implements IEmailDeliveryAdapter {
  async send(payload: EmailPayload): Promise<DeliveryResult> {
    const simulatedId = `sim_${Date.now()}_${crypto.randomBytes(4).toString('hex')}@reachinbox.simulated`;

    // Simulate brief processing latency (50ms)
    await new Promise((resolve) => setTimeout(resolve, 50));

    return {
      messageId: simulatedId,
      previewUrl: null,
      simulated: true,
      provider: 'simulated_delivery',
      metadata: {
        simulatedAt: new Date().toISOString(),
        recipient: payload.to,
        sender: payload.from,
        deliveryMode: 'simulated_demo',
        note: 'Simulated delivery adapter: Outbound SMTP (ports 25, 465, 587) is blocked on free tier hosting (Render). This event was recorded as simulated without asserting external SMTP delivery.',
      },
    };
  }
}

/**
 * Factory function to retrieve the active email delivery adapter
 * based on environment configuration.
 */
export function getEmailDeliveryAdapter(): IEmailDeliveryAdapter {
  if (env.EMAIL_DELIVERY_MODE === 'simulated') {
    return new SimulatedDeliveryAdapter();
  }
  return new EtherealSmtpAdapter();
}
