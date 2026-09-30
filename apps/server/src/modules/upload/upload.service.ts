import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const MAX_SIZE = 10 * 1024 * 1024; // 10MB/张

/** multer 上传文件的最小形状（不依赖 Express.Multer 类型命名空间） */
export interface UploadFileShape {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

/** 按文件头 magic bytes 识别真实图片类型（不信任扩展名/客户端 mimetype） */
function detectImageType(buf: Buffer): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'jpg';
  }
  if (
    buf.length >= 4 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47
  ) {
    return 'png';
  }
  if (buf.length >= 4 && buf.slice(0, 4).toString('latin1') === 'GIF8') {
    return 'gif';
  }
  if (
    buf.length >= 12 &&
    buf.slice(0, 4).toString('latin1') === 'RIFF' &&
    buf.slice(8, 12).toString('latin1') === 'WEBP'
  ) {
    return 'webp';
  }
  return null;
}

@Injectable()
export class UploadService {
  /** 保存图片文件，返回可访问的相对 URL 列表 */
  async saveImages(files: UploadFileShape[]): Promise<string[]> {
    if (!files?.length) throw new BadRequestException('请选择图片文件');
    const urls: string[] = [];
    for (const file of files) {
      if (file.size > MAX_SIZE) {
        throw new BadRequestException('单张图片不能超过 10MB');
      }
      const ext = detectImageType(file.buffer);
      if (!ext) {
        throw new BadRequestException('文件不是有效的图片（仅支持 jpg/png/webp/gif）');
      }
      const filename = `${randomUUID()}.${ext}`;
      const dir = join(process.cwd(), process.env.UPLOAD_DIR ?? 'uploads');
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, filename), file.buffer);
      urls.push(`/static/${filename}`);
    }
    return urls;
  }
}
