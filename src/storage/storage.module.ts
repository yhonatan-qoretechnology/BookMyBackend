import { Global, Module } from '@nestjs/common';
import { SftpStorageService } from './sftp-storage.service';

@Global()
@Module({
  providers: [SftpStorageService],
  exports: [SftpStorageService],
})
export class StorageModule {}
