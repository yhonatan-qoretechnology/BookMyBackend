import { Controller, Get, Logger } from '@nestjs/common';
import { GeographicService } from './geographic/geographic.service';
import { PersonalDocumentsService } from './geographic/personal-documents/personal-documents.service';

@Controller('data')
export class DataController {
  private readonly logger = new Logger(DataController.name);
  constructor(
    private geographicService: GeographicService,
    private personalDocumentsService: PersonalDocumentsService,
  ) {}

  @Get('geographic/country')
  public async getData() {
    this.logger.log('Peticion recibida para obtener datos');
    try {
      const data = await this.geographicService.getGeographicData();
      this.logger.log(`Datos obtenidos correctamente ${data.length} registros`);
      return {
        //message: 'Datos obtenidos correctamente',
        data: data,
        //total: data.length,
      };
    } catch (error) {
      this.logger.error(
        `Error al obtener los datos: ${error.message}`,
        error.stack,
      );
      return {
        message: 'Error al obtener los datos',
        error: error.message,
      };
    }
  }

  //GET data/personal-documents/{countryId}/{type}
  /*
  @Get('personal-documents/{:countryId}/{:type}')
  public async getPersonalDocumentsByCountryAndClient(
    @Param('countryId') countryId: string,
    @Param('type', new ParseEnumPipe(ClientType, { optional: false }))
    type: ClientType,
  ) {
    return this.personalDocumentsService.getDocumentTypesByCountry(
      countryId,
      type,
    );
  }
  */
}
