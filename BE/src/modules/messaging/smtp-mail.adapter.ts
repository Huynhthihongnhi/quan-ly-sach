import { connect, type Socket } from 'node:net';
import { Injectable } from '@nestjs/common';
import { MessagingConfigService } from './messaging-config.service';
import type { MailAdapter, MailMessage } from './messaging.types';

@Injectable()
export class SmtpMailAdapter implements MailAdapter {
  constructor(private readonly config: MessagingConfigService) {}

  async send(message: MailMessage): Promise<void> {
    await sendSmtpMessage({
      host: this.config.mailHost,
      port: this.config.mailPort,
      from: this.config.mailFrom,
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
  }
}

async function sendSmtpMessage(input: {
  host: string;
  port: number;
  from: string;
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  const socket = await openSmtpSession(input.host, input.port);

  try {
    await readResponse(socket);
    await writeCommand(socket, `EHLO localhost`);
    await readResponse(socket);
    await writeCommand(socket, `MAIL FROM:<${input.from}>`);
    await readResponse(socket);
    await writeCommand(socket, `RCPT TO:<${input.to}>`);
    await readResponse(socket);
    await writeCommand(socket, 'DATA');
    await readResponse(socket);
    await writeCommand(
      socket,
      [
        `From: ${input.from}`,
        `To: ${input.to}`,
        `Subject: ${input.subject}`,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=utf-8',
        '',
        input.text,
        '.',
      ].join('\r\n'),
    );
    await readResponse(socket);
    await writeCommand(socket, 'QUIT');
  } finally {
    socket.end();
  }
}

function openSmtpSession(host: string, port: number): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = connect(port, host);
    socket.once('error', reject);
    socket.once('connect', () => resolve(socket));
  });
}

function writeCommand(socket: Socket, command: string): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.write(`${command}\r\n`, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function readResponse(socket: Socket): Promise<string> {
  return new Promise((resolve, reject) => {
    socket.once('error', reject);
    socket.once('data', (chunk: Buffer) => {
      const response = chunk.toString('utf8');
      const code = Number.parseInt(response.slice(0, 3), 10);
      if (Number.isNaN(code) || code >= 400) {
        reject(new Error(`SMTP error: ${response.trim()}`));
        return;
      }
      resolve(response);
    });
  });
}
