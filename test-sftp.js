const SftpClient = require('ssh2-sftp-client');

const config = {
  host: 'access878014487.webspace-data.io',
  port: 22,
  username: 'u105302150',
  password: '@Qore202book#',
  readyTimeout: 10000,
};

async function test() {
  const sftp = new SftpClient();
  try {
    console.log('Conectando a SFTP...');
    await sftp.connect(config);
    console.log('CONECTADO OK!');

    console.log('Listando /clickandbuilds...');
    const cbList = await sftp.list('/clickandbuilds');
    console.log(
      'Carpetas en /clickandbuilds:',
      cbList.map((f) => f.name).join(', '),
    );

    const bookmyExists = cbList.find((f) => f.name === 'bookmy');
    if (bookmyExists) {
      console.log('\nListando /clickandbuilds/bookmy...');
      const bmList = await sftp.list('/clickandbuilds/bookmy');
      console.log('Carpetas:', bmList.map((f) => f.name).join(', '));
    }

    await sftp.end();
  } catch (err) {
    console.error('ERROR:', err.message);
    console.error('Code:', err.code);
  }
  process.exit(0);
}

test();
