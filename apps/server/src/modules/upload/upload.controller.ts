import {
  Controller,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { UploadService, UploadFileShape } from './upload.service.js';
import { AuthGuard } from '../../common/guards/auth.guard.js';
import { ApiTags } from '@nestjs/swagger';

@Controller('upload')
@ApiTags('upload')
export class UploadController {
  constructor(private readonly upload: UploadService) {}

  /** multipart 字段名 files，最多 9 张 */
  @Post('images')
  @UseGuards(AuthGuard)
  @UseInterceptors(FilesInterceptor('files', 9))
  images(@UploadedFiles() files: UploadFileShape[]) {
    return this.upload.saveImages(files).then((urls) => ({ urls }));
  }
}
