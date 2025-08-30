import { PartialType } from '@nestjs/swagger';
import { CreateServiceDto } from 'src/data/serviceCategory/dto/create-service.dto';

export class UpdateServiceDto extends PartialType(CreateServiceDto) {}
