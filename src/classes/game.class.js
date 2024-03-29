import Player from "./player.class"


export default class Game {
    constructor(players, allEvents) {
        return new Promise((r, f) => {
            /** VARIABLES */
            this.PLAYERS = []
            players.map((player) => {
                let newPlay = new Player(player.index, player.nom, player.fluid)
                this.PLAYERS.push(newPlay)
            })


            this.SPECIALEVENT = false
            this.PARTICIPANTS_DAY = []
            this.DEADS = []
            this.LAST_DEADS = []
            this.GROUPS = []
            this.ZOMBIES = []
            this.TO_ZOMBIFY = []


            this.DAY = 0
            this.EVENTS = allEvents
            for (let i in this.EVENTS) {
                this.EVENTS[i] = this.randomize(this.EVENTS[i])
            }


            this.difficulte_rencontre = 14 // 14
            this.difficulte_charmer = 0 // 10
            this.difficulte_cacher = 18 // 18
            this.difficulte_keep_love = 3 //3
            this.difficulte_win_love = 24 // 24
            this.difficulte_tisse_lien = 10 //10
            this.passion_step = { love: 18, quit_group: 3, inseparable_couple: 15 } // 18 -- 3 -- 15

            this.avantages_love = 5

            r(this)
        })
    }


    /*********************************** SET */

    set_day(number) {
        this.DAY = parseInt(number) + this.DAY

        //chaque nouveau jour, changement :
        this.difficulte_rencontre--
        this.difficulte_charmer++
    }


    /*********************************** ACTIONS */

    async start_day() {

        console.log("----------C'EST PARTI !---------")


        // MISE A JOUR AVANT JEU
        this.SPECIALEVENT = null
        this.SPECIALEVENT = {}
        await this.mise_a_jour_players()

        //Il n'y a plus de joueurs. Fin du jeu
        let is_end = await this.is_end()
        if (is_end.endgame) {
            return false
        }


        //préparation de la journée
        this.set_day(1)
        let event_type = "main"
        if (!is_end.no_events) {
            event_type = await this.choose_special_day() ?? "main"
        } else if (is_end.couple) {
            event_type = "end_lovers"
        }


        if (event_type && event_type.index) {
            this.SPECIALEVENT = event_type
            event_type = event_type.index

        } else if (event_type && event_type != "main") {
            this.SPECIALEVENT = {
                index: event_type,
                name: this.EVENTS[event_type][0].name,
                desc: this.EVENTS[event_type][0].desc
            }
        } else {
            this.SPECIALEVENT = false
        }


        // JOURNEE : PREPARATION AFFICHAGE

        this.PLAYERS = this.randomize(this.PLAYERS)

        this.CACHE_PARTICIPANTS_DAY = await this.recup_participants_day()
        for (let i in this.CACHE_PARTICIPANTS_DAY) {
            let player = this.CACHE_PARTICIPANTS_DAY[i]
            let event = this.EVENTS[event_type][Math.floor(Math.random() * this.EVENTS[event_type].length)]


            let participant = await this.do_day(player, event)

            if (participant) { this.PARTICIPANTS_DAY.push(participant) }

        }

        console.log(this)
        return this.PARTICIPANTS_DAY

    }

    /**
     * Prépare l'affichage et l'activité du joueur
     * @param {*} player 
     * @param {*} event 
     */
    async do_day(player, event) {

        return new Promise((r, f) => {

            let new_group = false
            let meet = false
            player.action = player.action ? player.action : false
            //que fait-il ?
            if (!player.action) {

                if (player.next_move == "degroup") {
                    //couple se sépare
                    player.get_phrase("lovers_end")
                    r(player)
                    return player
                }

                if (player.is_group && !player.is_love && !this.SPECIALEVENT.index) {
                    //SI GROUPE
                    // GERE LA PASSION ENTRE EUX
                    player = this.passion_and_love(player)
                }


                if (player.is_group && player.is_love && !player.action && !this.SPECIALEVENT.index) {
                    //SI AMOUR
                    player = this.couple_is_love(player)
                }


                // RENCONTRES : peuvent s'éviter, se regrouper ou se battre
                if (!player.action && player.roll_dice("CHANCE", this.difficulte_rencontre) && (!this.SPECIALEVENT.index || this.SPECIALEVENT.index == "starter")) {

                    //selection de la personne rencontrée
                    let try_meet = false
                    let meet = false
                    let count = 0
                    do {
                        try_meet = this.CACHE_PARTICIPANTS_DAY[Math.floor(Math.random() * this.CACHE_PARTICIPANTS_DAY.length)]
                        count++
                    } while (
                        count < 5
                        && try_meet.index == player.index
                        || try_meet.action
                    )

                    if (count < 5) {
                        meet = try_meet
                    }

                

                    if (meet) {
                        player.action = "meet"
                        //si meet est plus fort en combat, alors tentative de fuite
                        let dice = false
                        if (meet.CARAC.FIGHT > player.CARAC.FIGHT) {
                            dice = player.roll_dice("RAPIDITE", this.difficulte_cacher)
                        }

                        if (!dice) {
                            if (
                                meet
                                && this.CACHE_PARTICIPANTS_DAY.length > 2
                                && !meet.is_zombie
                                && !player.is_zombie
                                && player.roll_dice("CHARME", this.difficulte_charmer)
                                && !player.is_love
                                && !meet.is_love
                            ) {

                                player.action = "group"
                                meet.action = "group"
                                new_group = this.group(player, meet)

                            } else {
                                if(player.is_zombie && meet.is_zombie){ return ; }

                                player.action = "fight"
                                meet.action = "fight"
                                let result = this.figth(player, meet)


                                if (result && result.death) {
                                   

                                    if (result.winner.is_zombie) {
                                        this.prepare_zombifying(result.death)
                                    } else {
                                        this.kill_player(result.death, "Mort sous les coups de " + result.winner.name)
                                    }

                                }

                                new_group = this.group(player, meet, "fight", result)
                            }

                        } else {
                            player.action = "run_away"
                        }
                    }

                }


                //si aucun cas précédent, alors évènement aléatoire du fichier json
                if (!player.action) {
                    //EVENT ALEATOIRE
                    player.action = "aleatoire event"
                    if (player.is_zombie) {
                        player.get_phrase("zomby")
                    } else {
                        this.do_event(player, event)
                    }

                } else {
                    if (!meet) { meet = false }

                    player.get_phrase(player.action, {
                        player2: meet
                    }, player.action_particuliere ?? false)
                }




                r(new_group ? new_group : player)
            } else {
                r(false)
            }


        })


    }



    async recup_participants_day() {
        return new Promise((r, f) => {
            let participants = []

            for (let i in this.PLAYERS) {
                let player = this.PLAYERS[i]

                if (!player.ALIVE && !player.is_zombie) {
                    continue
                } else if (player.in_group) {
                    continue
                } else {
                    participants.push(player)
                }
            }

            for (let i in this.GROUPS) {
                if (!this.GROUPS[i].ALIVE || this.GROUPS[i].hidden) {
                    continue
                }
                participants.push(this.GROUPS[i])
            }


            for (let i in this.ZOMBIES) {
                participants.push(this.ZOMBIES[i])
            }

            r(participants)
        })
    }


    async mise_a_jour_players() {
        return new Promise((r, f) => {
            for (let i in this.PLAYERS) {
                let player = this.PLAYERS[i]

                player.text = false

                if (player.next_move && player.next_move == "dead" && (!player.is_zombie || player.is_really_dead)) {
                    this.DEADS.push(player)
                }

                if (player.CARAC.PV <= 0 && (!player.is_zombie || player.is_really_dead)) {
                    player.ALIVE = false
                }

                this.PLAYERS[i].action = false
            }

            for (let i in this.GROUPS) {
                this.GROUPS[i].action = false

                if (this.GROUPS[i].CARAC.PV <= 0) {
                    this.GROUPS[i].ALIVE = false
                }

                if (this.GROUPS[i].next_move && this.GROUPS[i].next_move == "degroup") {

                    this.GROUPS[i].action = "degroup"
                    for (let d in this.GROUPS[i].membres) {
                        this.GROUPS[i].membres[d].in_group = false

                        //si l'un des membres est un groupe, alors il revient comme tel
                        if (this.GROUPS[i].membres[d].is_group && this.GROUPS[i].next_move == "degroup") {
                            this.GROUPS[i].membres[d].hidden = false
                        }
                    }
                    delete this.GROUPS[i]
                }
            }

            for (let i in this.ZOMBIES) {
                this.ZOMBIES[i].action = false
            }

            this.last_deads_to_deads().then(() => {
                r(true)
            })

        })
    }

    choose_special_day() {
        return new Promise((r, f) => {
            let result = {}
            switch (this.DAY) {
                case 1:
                    result = {
                        index: "starter",
                        name: "Coup d'envoi",
                        desc: "Les joueurs s'élancent sur le terrain, chacun pour soi et les combats commencent déjà !"
                    }
                    break;

                //case 2:
                case 5:
                case 10:
                    let events = [
                        "cold",
                        "sun",
                        "troupeau",
                        "tempete",
                        "volcan"
                    ]
                    result = events[Math.floor(Math.random() * events.length)]
                    //result = "volcan";
                    break;

                default:
                    result = "main"
                    break;
            }

            r(result)
        })
    }


    last_deads_to_deads() {
        return new Promise((r, f) => {

            let indexer = []
            let copy = this.PLAYERS
            let copy_zomby = this.TO_ZOMBIFY

            for (let i in this.LAST_DEADS) {
                if (!this.LAST_DEADS[i].is_zombie) {
                    indexer.push(this.LAST_DEADS[i].index)
                    this.DEADS.push(this.LAST_DEADS[i])
                }
            }

            for (let i in this.PLAYERS) {
                if (indexer.indexOf(this.PLAYERS[i].index) >= 0) {
                    delete copy[i]
                }
            }

            for (let i in this.TO_ZOMBIFY) {
                this.ZOMBIES.push(this.TO_ZOMBIFY[i])
                this.TO_ZOMBIFY[i].zombify()
                delete copy_zomby[i]
            }


            this.PLAYERS = copy.filter(function (n) { return n != undefined });
            this.TO_ZOMBIFY = copy_zomby.filter(function (n) { return n != undefined });

            this.LAST_DEADS = []
            this.PARTICIPANTS_DAY = []
            r(true)


        })

    }

    delete_player_from_PLAYERS(player, replace = false) {
        return new Promise((r, f) => {
            let copy = this.PLAYERS
            for (let i in this.PLAYERS) {
                if (this.PLAYERS[i].index == player.index) {
                    if (!replace) {
                        delete copy[i]
                    } else {
                        copy[i] = replace
                    }
                }
            }

            this.PLAYERS = copy
            r(copy)

        })

    }

    delete_group_from_GROUPS(group) {
        let copy = this.GROUPS
        for (let i in this.GROUPS) {
            if (this.GROUPS[i].index == group.index) {
                delete copy[i]
            }
        }

        this.GROUPS = copy
    }

    async is_end() {
        //fin d'une personne
        //fin d'un groupe
        //fin lover
        //fin zombie

        let result = {
            endgame: false,
            winner: false
        }


        let players_in_game = await this.recup_participants_day()
        console.log(players_in_game);

        let group_alive = 0
        let zombies_alive = 0
        let player_alive = 0
        let lovers_alive = 0

        let last_group = false
        let last_player = false

        for (let i in players_in_game) {
            let player = players_in_game[i]

            player_alive++

            if (player.is_group) {
                group_alive++
                last_group = player
            }
            if (player.is_love) {
                lovers_alive++
            }
            if (player.is_zombie) {
                zombies_alive++
            }

            if(!player.is_zombie && !player.is_group && !player.is_love){
                last_player = player
            }

        }

        if (player_alive == 1) {
            if (player_alive == zombies_alive) { //il ne reste qu'un zombie
                result.endgame = true
                result.winner = { name: "Zombicalypse !", text_win: "Les zombies ont pris le contrôle du terrain ! J'espère que nos équipes arriveront à les contenir avant que tout cela ne dégènère..." }
            } else if (group_alive == player_alive) { // il ne reste qu'un groupe
                if (player_alive == lovers_alive) { // il ne reste qu'un couple
                    result = this.end_for_lovers(last_group)
                } else {
                    result.endgame = false
                    result.no_events = true
                    last_group.passion = -999
                    this.difficulte_charmer = 900 // empêche de se remettre ensemble
                }
            } else { //il ne reste qu'une personne
                result.endgame = true
                result.winner = last_player
            }
        } else if(!player_alive && !group_alive){
            result.endgame = true
            result.winner = { name: "Personne", text_win: "Incroyable ! Tout le monde est mort sur la dernière ligne droite ! Ce n'est pas arrivé depuis les années 80'" }
        } else if (player_alive == zombies_alive) { // il ne reste que des zombies
            result.endgame = true
            result.winner = { name: "Zombicalypse !", text_win: "Les zombies ont pris le contrôle du terrain ! J'espère que nos équipes arriveront à les contenir avant que tout cela ne dégènère..." }
        } else { // pas de fin de game
        }


        if (result.winner) {
            this.WINNER = result.winner
        }

        return result
    }

    /*********************************** EVENTS */

    /**
     * Vérifie chaque tour, pour un groupe non amoureux, si leurs liens se tissent ou se dégradent.
     * Passé un niveau de passion, ils tombent amoureux. En dessous d'un autre, ils quittent le groupe (this.passion_step{love, quit_group})
     * @param {*} player_group 
     * @returns 
     */
    passion_and_love(player_group) {


        if (player_group.all_photo.length <= 2 && player_group.passion >= this.passion_step.love) {
            player_group.action = "love"
            this.love(player_group)
        } else if (player_group.passion <= this.passion_step.quit_group) {
            this.degroup(player_group)
        } else {
            let dice = player_group.roll_dice("CHARME", this.difficulte_tisse_lien, true)
            if (dice >= 20) {
                player_group.action = "tisse_lien"
                player_group.passion = player_group.passion + 8

            } else if (dice <= 2) {
                player_group.action = "break_lien"
                player_group.passion = player_group.passion - 5

            } else if (dice < 9) {
                player_group.passion = player_group.passion - 1

            } else {
                player_group.passion = player_group.passion + 1

            }
        }

        return player_group

    }


    /**
     * Verifie que le couple tiennent toujours.
     * @param {*} player_lovers 
     * @returns 
     */
    couple_is_love(player_lovers) {
        let dice = player_lovers.roll_dice("CHARME", this.difficulte_keep_love, true)
        if (dice >= 20) {
        } else if (dice <= 0) {
            player_lovers.action = "delove"
            player_lovers.next_move = "degroup"
        } else if (dice > this.difficulte_keep_love /*- player_lovers.passion*/) {
            player_lovers.action = "tisse_lien"
            player_lovers.passion = player_lovers.passion ? 5 : player_lovers.passion + 5
        } else {
            player_lovers.passion = player_lovers.passion ? 0.1 : player_lovers.passion + 0.1
        }


        return player_lovers
    }


    do_event(player, event) {
        let dice_result_event = player.roll_dice(event.on, event.diff, true)


        if (dice_result_event == 0) {
            player.text = player.is_group ? event.text_gr?.crit_lose ?? "" : event.text.crit_lose
            this.result_event(player, event, "crit_lose")
            player.result_event = "damage"

        } else if (dice_result_event == 20) {
            player.text = player.is_group ? event.text_gr?.crit_win ?? "" : event.text.crit_win
            this.result_event(player, event, "crit_win")
            player.result_event = "default"

        } else if (dice_result_event < event.diff) {
            player.text = player.is_group ? event.text_gr?.lose ?? "" : event.text.lose
            this.result_event(player, event, "lose")
            player.result_event = "damage"
            //player.CARAC.PV = 0

        } else {
            player.text = player.is_group ? event.text_gr?.win ?? "" : event.text.win
            this.result_event(player, event, "win")
            player.result_event = "default"
        }

        if (Array.isArray(player.text)) {
            player.text = player.text[Math.floor(Math.random() * player.text.length)]
        }

        if (player.CARAC.PV <= 0) {
            this.kill_player(player, event.result.death)
        }
    }


    result_event(player, event, win_or_lose) {
        if (event.result[win_or_lose].carac == "ZOMBIE") {
            this.prepare_zombifying(player, event.result.death)
        } else {
            if (!player.CARAC[event.result[win_or_lose].carac]) {
                player.CARAC[event.result[win_or_lose].carac] = 0
            }
            player.CARAC[event.result[win_or_lose].carac] = player.CARAC[event.result[win_or_lose].carac] + parseInt(event.result[win_or_lose].number)
        }

    }

    /*********************************** ON PLAYER */

    kill_player(player, text) {

        if (player.is_group) {
            for (let i in player.membres) {
                this.kill_player(player.membres[i], text)
            }
        } else {
            this.LAST_DEADS.push(player)
            player.next_move = "dead"
            player.text_death = text ? text : "Mort de raisons inconnues"

            if(Array.isArray(player.text_death)){
                player.text_death = player.text_death[Math.floor(Math.random() * player.text_death.length)]
            }

/*
            if (player.is_zombie) {
                player.is_really_dead = true
            }*/
        }

    }

    love(player) {
        let newname = "Couple"
        for (let i in player.membres) {
            newname = newname + ((i == 0) ? " " : " et ") + player.membres[i].name
        }
        player.is_love = true
        player.get_phrase("love")
        player.name = newname
        for (let i in player.CARAC) {
            player.CARAC[i] += this.avantages_love
        }
    }


    /**
     * Retourne {winner : le gagnant, death : si l'un des deux est mort} si quelqu'un meurt
     * @param {*} player1 
     * @param {*} player2 
     * @returns 
     */
    figth(player1, player2) {
        let result = {
            winner: false,
            death: false,
            loser: false
        }

        //on fait le combat
        let coup = 3
        for (let i = 0; i <= coup; i++) {
            if (i % 2 === 0) {
                if (!player1.frappe(player2)) {
                    //player1 a tué player2
                    result.winner = player1
                    result.death = player2
                    result.loser = player2
                    return result

                }
            } else {
                if (!player2.frappe(player1)) {
                    //player2 a tué player1
                    result.winner = player2
                    result.death = player1
                    result.loser = player1
                    return result
                }
            }
        }

        //personne n'est mort
        if (player1.CARAC.PV > player2.CARAC.PV) {
            result.winner = player1
            result.loser = player2
        } else if (player2.CARAC.PV > player1.CARAC.PV) {
            result.winner = player2
            result.loser = player1
        } else {
            result.winner = player1
            result.loser = player2
        }
        return result

    }

    prepare_zombifying(player) {
        this.TO_ZOMBIFY.push(player)
        player.ALIVE = false
        player.zombifing = true
        if(!player.text_death){
            this.kill_player(player, [
                "Aïe aïe aïe ! Ne serait-ce pas la morsure d'un zombie qui agit ?",
                "La morsure du zombie est sacrément efficace",
                "Walking Dead ? Vous connaissez ?"
            ])
        } else {
            this.kill_player(player)
        }

    }

    end_for_lovers(group_lovers) {
        let result = {}
        result.no_events = true
        result.endgame = false

        if (group_lovers.CARAC.WIN && group_lovers.CARAC.WIN >= 1) {
            result.endgame = true
            result.winner = group_lovers
            group_lovers.text_win = "POPOPOPOOOOOOOOOW !!! L'amour l'emporte sur tout !!! C'est " + group_lovers.name + " qui gagne la Battle !!!"
        }



        if (group_lovers.passion >= this.passion_step.inseparable_couple) {
            //ils s'aiment trop pour se séparer
            result.couple = true

        }
        else {
            // ils se trahissent
            this.degroup(group_lovers, "lovers_end")
        }


        return result
    }


    async group(player1, player2, type = "group", result_fight) {
        let new_group = player1.group(player2)
        if (type == "fight" || type == "degroup") {
            new_group.next_move = "degroup"
        }
        new_group.get_phrase(type, (type == "fight") ? result_fight : false)
        new_group.action = type ?? false

        //on retire le groupe si il existait déjà
        if (player1.is_group) {
            player1.hidden = true
        }
        if (player2.is_group) {
            player2.hidden = true
        }


        this.GROUPS.push(new_group)

        return new_group
    }

    async degroup(group, type_text = false) {
      
        group.next_move = "degroup"

        if (type_text) {
            group.get_phrase(type_text)
        } else {
            group.action = "degroup"
        }

    }

    /*********************************** BONUS */

    randomize(arr) {

        var i, j, tmp;
        for (i = arr.length - 1; i > 0; i--) {
            j = Math.floor(Math.random() * (i + 1));
            tmp = arr[i];
            arr[i] = arr[j];
            arr[j] = tmp;
        }
        return arr;
    }
}




//image fin zomby

//zombie really_dead

//partager sa partie


