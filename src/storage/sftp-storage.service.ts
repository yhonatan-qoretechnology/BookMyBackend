import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class SftpStorageService {
  constructor(private readonly configService: ConfigService) {}

  isEnabled() {
    const host = this.configService.get<string>('SFTP_HOST');
    const username = this.configService.get<string>('SFTP_USER');
    const password = this.configService.get<string>('SFTP_PASSWORD');
    const remoteRoot = this.configService.get<string>('SFTP_REMOTE_ROOT_PATH');
    const publicBase = this.configService.get<string>(
      'UPLOADS_PUBLIC_BASE_URL',
    );
    return Boolean(host && username && password && remoteRoot && publicBase);
  }

  private async createClient() {
    try {
      const mod: any = await import('ssh2-sftp-client');
      const Client = mod?.default ?? mod;
      return new Client();
    } catch (error) {
      throw new Error(
        'Dependencia ssh2-sftp-client no instalada. Ejecuta: npm i ssh2-sftp-client',
      );
    }
  }

  private getPublicBaseUrl() {
    return (this.configService.get<string>('UPLOADS_PUBLIC_BASE_URL') ?? '')
      .trim()
      .replace(/\/+$/g, '');
  }

  private getRemoteRootPath() {
    return (this.configService.get<string>('SFTP_REMOTE_ROOT_PATH') ?? '')
      .trim()
      .replace(/\/+$/g, '');
  }

  private joinPosix(...parts: string[]) {
    return parts
      .filter((p) => p !== undefined && p !== null)
      .map((p) => p.replace(/\\/g, '/'))
      .join('/')
      .replace(/\/+/g, '/');
  }

  private sanitizeRelativePath(p: string) {
    const normalized = p.replace(/\\/g, '/').replace(/^\/+/, '');
    if (!normalized || normalized.includes('..')) {
      throw new Error('Remote path inválido');
    }
    return normalized;
  }

  private getRemotePathFromRelative(relativePath: string) {
    const root = this.getRemoteRootPath();
    const rel = this.sanitizeRelativePath(relativePath);
    if (!root) {
      throw new Error('SFTP_REMOTE_ROOT_PATH no configurado');
    }
    return this.joinPosix(root, rel);
  }

  private getPublicUrlFromRelative(relativePath: string) {
    const base = this.getPublicBaseUrl();
    const rel = this.sanitizeRelativePath(relativePath);
    if (!base) {
      throw new Error('UPLOADS_PUBLIC_BASE_URL no configurado');
    }
    return `${base}/${rel}`;
  }

  private getSftpConfig() {
    const host = this.configService.get<string>('SFTP_HOST');
    const port = Number(this.configService.get<string>('SFTP_PORT') ?? '22');
    const username = this.configService.get<string>('SFTP_USER');
    const password = this.configService.get<string>('SFTP_PASSWORD');

    const sanitizedUsername = username?.replace(/^SFTP_USER=/, '').trim();
    const sanitizedPassword = password
      ?.trim()
      .replace(/^"|"$/g, '')
      .replace(/^'|'$/g, '');

    //console.log('[SFTP] Host:', host);
    //console.log('[SFTP] User:', username);
    //console.log('[SFTP] Password raw:', JSON.stringify(password));
    //console.log('[SFTP] Password length:', password?.length);

    if (!host || !sanitizedUsername) {
      throw new Error('Credenciales SFTP incompletas');
    }

    // Intentar primero con contraseña
    if (sanitizedPassword) {
      return {
        host,
        port,
        username: sanitizedUsername,
        password: sanitizedPassword,
        readyTimeout: 20000,
        retries: 2,
        retry_factor: 2,
        retry_minTimeout: 2000,
      };
    }

    throw new Error('SFTP_PASSWORD no configurada');
  }

  async uploadLocalFile(params: {
    localPath: string;
    remoteRelativePath: string;
    deleteLocalAfter?: boolean;
  }) {
    if (!this.isEnabled()) {
      throw new Error('SFTP no está configurado en variables de entorno');
    }

    const deleteLocalAfter = params.deleteLocalAfter ?? true;
    const remoteRelativePath = this.sanitizeRelativePath(
      params.remoteRelativePath,
    );
    const remoteFullPath = this.getRemotePathFromRelative(remoteRelativePath);
    const remoteDir = path.posix.dirname(remoteFullPath);

    const client = await this.createClient();
    try {
      await client.connect(this.getSftpConfig());
      await client.mkdir(remoteDir, true);
      await client.put(params.localPath, remoteFullPath);
    } finally {
      try {
        await client.end();
      } catch {
        // ignore
      }
    }

    if (deleteLocalAfter) {
      try {
        if (fs.existsSync(params.localPath)) {
          fs.unlinkSync(params.localPath);
        }
      } catch {
        // ignore
      }
    }

    return {
      relativePath: remoteRelativePath,
      publicUrl: this.getPublicUrlFromRelative(remoteRelativePath),
    };
  }

  async deleteByPublicUrl(publicUrl: string) {
    const base = this.getPublicBaseUrl();
    if (!publicUrl || !base) return;

    const normalizedUrl = publicUrl.trim();
    if (!normalizedUrl.startsWith(base)) return;

    const rel = normalizedUrl
      .slice(base.length)
      .replace(/^\/+/, '')
      .replace(/\?.*$/, '');

    if (!rel) return;

    await this.deleteByRelativePath(rel);
  }

  async deleteByRelativePath(relativePath: string) {
    const rel = this.sanitizeRelativePath(relativePath);
    const remoteFullPath = this.getRemotePathFromRelative(rel);

    const client = await this.createClient();
    try {
      await client.connect(this.getSftpConfig());
      const exists = await client.exists(remoteFullPath);
      if (exists) {
        await client.delete(remoteFullPath);
      }
    } finally {
      try {
        await client.end();
      } catch {
        // ignore
      }
    }
  }
}
