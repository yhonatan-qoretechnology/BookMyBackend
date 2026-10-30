import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RecaptchaGuard } from './recaptcha.guard';
import { RecaptchaService } from './recaptcha.service';

/** Global: cualquier controlador puede usar @Recaptcha() sin importarlo. */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [RecaptchaService, RecaptchaGuard],
  exports: [RecaptchaService, RecaptchaGuard],
})
export class RecaptchaModule {}
