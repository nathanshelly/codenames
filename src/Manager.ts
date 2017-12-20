import { Card } from './Card';
import { Game } from './Game';
import { Lobby } from './Lobby';
import { Player } from './Player';
import { Loiterer } from './Loiterer';
import { Operative } from './Operative';
import { PlayerState } from './PlayerState';
import { Broadcaster } from './Broadcaster';
import { Team, PlayerLocation } from './constants/Constants';
import { GameUtility as gu } from './GameUtility';
import { RuleEnforcer as re } from './RuleEnforcer';

import ws = require('ws');

export class Manager {
	playerStates: Map<ws, PlayerState>;
	loners: Map<string, Player>;
	lobbies: Map<string, Lobby>;
	games: Map<string, Game>;

	// make instance of Game class
	constructor() {
		this.playerStates = new Map();
		this.loners = new Map();
		this.lobbies = new Map();
		this.games = new Map();
	}

	handleClose(socket: ws) {
		if(!this.playerStates.has(socket)) {
			console.log('User hadn\'t set name, no player to remove');
			return;
		}

		// player exists somewhere
		let state = this.playerStates.get(socket) as PlayerState;

		switch(state.getLoc()) {
			case PlayerLocation.loner:
				this.removeLoner(socket, state.getPid())
				console.log(`Removed player from loners with id: ${state.getPid()}`)
				break;
			case PlayerLocation.lobby:
				if(this.lobbies.has(state.getGid())) {
					(this.lobbies.get(state.getGid()) as Lobby).removeLoiterer(socket);
					console.log(`Removed player from lobby ${state.getGid()} with id: ${state.getPid()}`)
				}
				break;
			default:
				console.log('Sorry, unknown player location.')
		}
		// TODO: need to handle this somehow, map of sockets to gid?
		// this.games.get().removePerson(socket);
	}

	removeLoner(socket: ws, pid: string): void {
		this.loners.delete(pid);
		this.playerStates.delete(socket);
	}

	handleMessage(message: any, socket: ws) {
		console.log(message)

		if(message.hasOwnProperty('action')) {
			let action: string = message.action;
			
			switch(action) {
				case "setName":
					console.log('Case setName reached');
					if (re.isValidName(message.name)) {
						// this.game.registerLoiterer(message.name, socket);
						this.registerPlayer(message.name, socket);
					}
					break;

				case "createLobby":
					this.lobbies.set('test', new Lobby('test'));
					this.placePlayer(message.pid, 'test', socket);
					break;

				case "joinLobby":
					if(this.lobbies.has(message.gid))
						this.placePlayer(message.pid, message.gid, socket);
					break;

				case "switchTeam":
					if(this.lobbies.has(message.gid))
						(this.lobbies.get(message.gid) as Lobby).switchLoitererTeam(message.pid);
					break;

				case "startGame":
					console.log('Case startGame reached');
					if(this.lobbies.has(message.gid)
					&& re.canStartGame(gu.getSloitererTeams((this.lobbies.get(message.gid) as Lobby).getLoiterers()))) {
						let lobby: Lobby = this.lobbies.get(message.gid) as Lobby;
						this.lobbies.delete(message.gid);
						this.games.set(message.gid, Game.gameFromLobby(lobby));
					}
					break;

				// game message
				case "endGame":
				case "endTurn":
				case "sendClue":
				case "toggleCard":
				case "submitGuess":
				case "sendMessage":
					if(this.games.has(message.gid))
						(this.games.get(message.gid) as Game).handleMessage(message, socket);
					break;

				default:
					console.log(`Whoops don't know what ${message} is`);
			}
		}
	}

	// adds player to loners array of players with no lobby
  registerPlayer(name: string, socket: ws) {
		let id = Date.now().toString(36);
		let loner = new Player(id, name, socket);
		this.loners.set(id, loner);
		
		this.playerStates.set(socket, new PlayerState(id));
		Broadcaster.updateLoner(loner);
	}
	
	placePlayer(pid: string, gid: string, socket: ws): boolean {
		// confirm that both exist, use casts later since we are synchronous we know
		// they must still exist
		if(!this.loners.has(pid) || !this.lobbies.has(gid) || !this.playerStates.has(socket))
			return false;

		let loner: Player = this.loners.get(pid) as Player;
		this.loners.delete(pid);
		(this.lobbies.get(gid) as Lobby).addPlayer(loner)

		let lonerState = this.playerStates.get(socket) as PlayerState;
		lonerState.placeInLobby(gid);
		
		return true;
	}
}