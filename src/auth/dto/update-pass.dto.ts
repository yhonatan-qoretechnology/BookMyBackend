import { IsNotEmpty, MinLength } from 'class-validator';

export class UpdatePassDto {
  @IsNotEmpty()
  @MinLength(6)
  password: string;
}
