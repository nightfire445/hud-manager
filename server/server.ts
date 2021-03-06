import WebSocket, { Server as WSServer } from 'ws';
import http from 'http';
import BufferReader from './hlae/BufferReader';
import GameEventUnserializer from './hlae/GameEventUnserializer';
import { GameEventObject } from './hlae/GameEventDescription';

const init = (callback: (data: GameEventObject) => void) => {
	const server = http.createServer();
	const webSocketServer = new WSServer({ server, path: '/mirv' });

	const enrichments = {
		player_death: ['userid', 'attacker', 'assister']
	};

	let socket: WebSocket;

	webSocketServer.on('connection', newSocket => {
		if (socket) {
			socket.close();
			socket = newSocket;
		}
		socket = newSocket;

		const gameEventUnserializer = new GameEventUnserializer(enrichments);

		socket.on('message', data => {
			if (!(data instanceof Buffer)) {
				return;
			}
			const bufferReader = new BufferReader(Buffer.from(data));
			try {
				while (!bufferReader.eof()) {
					const cmd = bufferReader.readCString();
					if (cmd !== 'hello' && cmd !== 'gameEvent') {
						return;
					}
					if (cmd === 'hello') {
						const version = bufferReader.readUInt32LE();
						if (2 != version) throw 'Error: version mismatch';
						socket.send(new Uint8Array(Buffer.from('transBegin\0', 'utf8')), { binary: true });
						socket.send(
							new Uint8Array(Buffer.from('exec\0mirv_pgl events enrich clientTime 1\0', 'utf8')),
							{ binary: true }
						);
						socket.send(
							new Uint8Array(
								Buffer.from(
									'exec\0mirv_pgl events enrich eventProperty "useridWithSteamId" "player_death" "userid"\0',
									'utf8'
								)
							),
							{ binary: true }
						);
						socket.send(
							new Uint8Array(
								Buffer.from(
									'exec\0mirv_pgl events enrich eventProperty "useridWithSteamId" "player_death" "attacker"\0',
									'utf8'
								)
							),
							{ binary: true }
						);
						socket.send(
							new Uint8Array(
								Buffer.from(
									'exec\0mirv_pgl events enrich eventProperty "useridWithSteamId" "player_death" "assister"\0',
									'utf8'
								)
							),
							{ binary: true }
						);
						socket.send(new Uint8Array(Buffer.from('exec\0mirv_pgl events enabled 1\0', 'utf8')), {
							binary: true
						});
						socket.send(new Uint8Array(Buffer.from('transEnd\0', 'utf8')), { binary: true });
						return;
					}
					const gameEvent = gameEventUnserializer.unserialize(bufferReader);
					if (gameEvent.name === 'player_death') {
						if (callback) {
							callback(gameEvent);
						}
						//console.log(JSON.stringify(gameEvent));
					}
				}
			} catch (err) {}
		});
	});
	server.listen(31337);
};
export default init;
