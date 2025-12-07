// No-Limit Texas Hold'em Poker Game

class Card {
    constructor(rank, suit) {
        this.rank = rank;
        this.suit = suit;
    }

    get value() {
        const values = { 'A': 14, 'K': 13, 'Q': 12, 'J': 11, 'T': 10 };
        return values[this.rank] || parseInt(this.rank);
    }

    get suitSymbol() {
        const symbols = { 'hearts': '♥', 'diamonds': '♦', 'clubs': '♣', 'spades': '♠' };
        return symbols[this.suit];
    }

    get displayRank() {
        return this.rank === 'T' ? '10' : this.rank;
    }

    toString() {
        return `${this.displayRank}${this.suitSymbol}`;
    }
}

class Deck {
    constructor() {
        this.reset();
    }

    reset() {
        this.cards = [];
        const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
        const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

        for (const suit of suits) {
            for (const rank of ranks) {
                this.cards.push(new Card(rank, suit));
            }
        }
        this.shuffle();
    }

    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }

    deal() {
        return this.cards.pop();
    }
}

class Player {
    constructor(id, name, chips, isHuman = false) {
        this.id = id;
        this.name = name;
        this.chips = chips;
        this.isHuman = isHuman;
        this.holeCards = [];
        this.currentBet = 0;
        this.folded = false;
        this.allIn = false;
        this.hasActed = false;
    }

    reset() {
        this.holeCards = [];
        this.currentBet = 0;
        this.totalContribution = 0; // Track total chips put in pot this hand
        this.folded = false;
        this.allIn = false;
        this.hasActed = false;
    }

    bet(amount) {
        const actualBet = Math.min(amount, this.chips);
        this.chips -= actualBet;
        this.currentBet += actualBet;
        this.totalContribution += actualBet; // Track total for side pot calculation
        if (this.chips === 0) {
            this.allIn = true;
        }
        return actualBet;
    }
}

class HandEvaluator {
    static evaluate(holeCards, communityCards) {
        const allCards = [...holeCards, ...communityCards];
        const combinations = this.getCombinations(allCards, 5);

        let bestHand = null;
        let bestRank = -1;

        for (const combo of combinations) {
            const rank = this.rankHand(combo);
            if (rank.value > bestRank) {
                bestRank = rank.value;
                bestHand = { cards: combo, rank: rank };
            }
        }

        return bestHand;
    }

    static getCombinations(arr, size) {
        const result = [];
        const combine = (start, combo) => {
            if (combo.length === size) {
                result.push([...combo]);
                return;
            }
            for (let i = start; i < arr.length; i++) {
                combo.push(arr[i]);
                combine(i + 1, combo);
                combo.pop();
            }
        };
        combine(0, []);
        return result;
    }

    static rankHand(cards) {
        const sorted = [...cards].sort((a, b) => b.value - a.value);
        const values = sorted.map(c => c.value);
        const suits = sorted.map(c => c.suit);

        const isFlush = suits.every(s => s === suits[0]);
        const isStraight = this.checkStraight(values);
        const counts = this.getCounts(values);
        const countValues = Object.values(counts).sort((a, b) => b - a);

        // Hand rank tiers - each tier is 1 million apart to prevent overlap
        const TIER = 1000000;

        // Royal Flush (Tier 9)
        if (isFlush && isStraight && values[0] === 14 && values[4] === 10) {
            return { name: 'Royal Flush', value: 9 * TIER };
        }

        // Straight Flush (Tier 8)
        if (isFlush && isStraight) {
            return { name: 'Straight Flush', value: 8 * TIER + (isStraight === 'wheel' ? 5 : values[0]) };
        }

        // Four of a Kind (Tier 7)
        if (countValues[0] === 4) {
            const quadValue = parseInt(Object.keys(counts).find(k => counts[k] === 4));
            const kicker = parseInt(Object.keys(counts).find(k => counts[k] === 1));
            return { name: 'Four of a Kind', value: 7 * TIER + quadValue * 15 + kicker };
        }

        // Full House (Tier 6)
        if (countValues[0] === 3 && countValues[1] === 2) {
            const tripValue = parseInt(Object.keys(counts).find(k => counts[k] === 3));
            const pairValue = parseInt(Object.keys(counts).find(k => counts[k] === 2));
            return { name: 'Full House', value: 6 * TIER + tripValue * 15 + pairValue };
        }

        // Flush (Tier 5)
        if (isFlush) {
            return { name: 'Flush', value: 5 * TIER + this.getKickerValue(values) };
        }

        // Straight (Tier 4)
        if (isStraight) {
            return { name: 'Straight', value: 4 * TIER + (isStraight === 'wheel' ? 5 : values[0]) };
        }

        // Three of a Kind (Tier 3)
        if (countValues[0] === 3) {
            const tripValue = parseInt(Object.keys(counts).find(k => counts[k] === 3));
            const kickers = Object.keys(counts).filter(k => counts[k] === 1).map(Number).sort((a, b) => b - a);
            return { name: 'Three of a Kind', value: 3 * TIER + tripValue * 225 + kickers[0] * 15 + kickers[1] };
        }

        // Two Pair (Tier 2)
        if (countValues[0] === 2 && countValues[1] === 2) {
            const pairs = Object.keys(counts).filter(k => counts[k] === 2).map(Number).sort((a, b) => b - a);
            const kicker = parseInt(Object.keys(counts).find(k => counts[k] === 1));
            return { name: 'Two Pair', value: 2 * TIER + pairs[0] * 225 + pairs[1] * 15 + kicker };
        }

        // One Pair (Tier 1)
        if (countValues[0] === 2) {
            const pairValue = parseInt(Object.keys(counts).find(k => counts[k] === 2));
            const kickers = Object.keys(counts).filter(k => counts[k] === 1).map(Number).sort((a, b) => b - a);
            return { name: 'One Pair', value: 1 * TIER + pairValue * 3375 + kickers[0] * 225 + kickers[1] * 15 + kickers[2] };
        }

        // High Card (Tier 0)
        return { name: 'High Card', value: this.getKickerValue(values) };
    }

    static checkStraight(values) {
        const sorted = [...new Set(values)].sort((a, b) => b - a);
        if (sorted.length < 5) return false;

        // Regular straight
        for (let i = 0; i <= sorted.length - 5; i++) {
            if (sorted[i] - sorted[i + 4] === 4) return true;
        }

        // Wheel (A-2-3-4-5)
        if (sorted.includes(14) && sorted.includes(5) && sorted.includes(4) && sorted.includes(3) && sorted.includes(2)) {
            return 'wheel';
        }

        return false;
    }

    static getCounts(values) {
        const counts = {};
        for (const v of values) {
            counts[v] = (counts[v] || 0) + 1;
        }
        return counts;
    }

    static getKickerValue(values) {
        // Use base 15 to ensure values stay within bounds (max card value is 14)
        let value = 0;
        for (let i = 0; i < values.length && i < 5; i++) {
            value += values[i] * Math.pow(15, 4 - i);
        }
        return value;
    }
}

class PokerGame {
    constructor() {
        this.players = [];
        this.deck = new Deck();
        this.communityCards = [];
        this.pot = 0;
        this.sidePots = [];
        this.currentBet = 0;
        this.minRaise = 0;
        this.dealerIndex = 0;
        this.currentPlayerIndex = 0;
        this.phase = 'preflop'; // preflop, flop, turn, river, showdown
        this.smallBlind = 10;
        this.bigBlind = 20;
        this.gameStarted = false;
        this.handInProgress = false;

        // Player tracking for AI exploitation
        this.playerStats = {
            handsPlayed: 0,
            showdowns: 0,
            foldToAggression: 0,      // Times folded when facing a raise
            facedAggression: 0,        // Times faced a raise
            bluffsRevealed: 0,         // Times caught bluffing (weak hand, big bet)
            valueRevealed: 0,          // Times shown strong hand with big bet
            allInBluffs: 0,            // All-ins with weak hands
            allInValue: 0,             // All-ins with strong hands
            avgBetStrength: [],        // Array of {betSize, handStrength} for correlation
            preflopRaiseRate: 0,       // How often player raises preflop
            preflopRaises: 0,
            preflopOpportunities: 0
        };

        this.initPlayers();
        this.bindEvents();
        this.updateUI();
    }

    initPlayers() {
        // Each AI has a unique playing style
        const playerData = [
            { name: 'You', style: null }, // Human
            { name: 'Alice', style: 'aggressive' },   // Bets big, bluffs often
            { name: 'Bob', style: 'tight' },          // Only plays strong hands
            { name: 'Charlie', style: 'loose' },      // Plays many hands, calls a lot
            { name: 'Diana', style: 'tricky' }        // Unpredictable, mixes it up
        ];
        for (let i = 0; i < 5; i++) {
            const player = new Player(i, playerData[i].name, 1000, i === 0);
            player.style = playerData[i].style;
            this.players.push(player);
        }
    }

    bindEvents() {
        document.getElementById('fold-btn').addEventListener('click', () => this.playerAction('fold'));
        document.getElementById('check-btn').addEventListener('click', () => this.playerAction('check'));
        document.getElementById('call-btn').addEventListener('click', () => this.playerAction('call'));
        document.getElementById('raise-btn').addEventListener('click', () => this.showRaiseControls());
        document.getElementById('allin-btn').addEventListener('click', () => this.playerAction('allin'));
        document.getElementById('confirm-raise').addEventListener('click', () => this.confirmRaise());
        document.getElementById('cancel-raise').addEventListener('click', () => this.hideRaiseControls());
        document.getElementById('new-game-btn').addEventListener('click', () => this.startNewGame());
        document.getElementById('next-hand-btn').addEventListener('click', () => this.startNewHand());

        // Raise slider and input sync
        const slider = document.getElementById('raise-slider');
        const input = document.getElementById('raise-input');

        slider.addEventListener('input', () => {
            input.value = slider.value;
        });

        input.addEventListener('input', () => {
            slider.value = input.value;
        });

        // Preset buttons
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const multiplier = parseFloat(btn.dataset.multiplier);
                const potBet = Math.floor(this.pot * multiplier);
                const minRaiseAmount = this.currentBet + this.minRaise;
                const raiseAmount = Math.max(potBet, minRaiseAmount);
                document.getElementById('raise-slider').value = raiseAmount;
                document.getElementById('raise-input').value = raiseAmount;
            });
        });
    }

    startNewGame() {
        // Reset all players
        for (const player of this.players) {
            player.chips = 1000;
            player.reset();
        }
        this.dealerIndex = Math.floor(Math.random() * 5);
        this.gameStarted = true;
        this.startNewHand();
    }

    startNewHand() {
        // Check for eliminated players
        const activePlayers = this.players.filter(p => p.chips > 0);
        if (activePlayers.length < 2) {
            this.showMessage(`${activePlayers[0]?.name || 'No one'} wins the game!`, 'win-message');
            document.getElementById('next-hand-btn').style.display = 'none';
            return;
        }

        // Reset for new hand
        this.deck.reset();
        this.communityCards = [];
        this.pot = 0;
        this.sidePots = [];
        this.currentBet = 0;
        this.minRaise = this.bigBlind;
        this.phase = 'preflop';
        this.handInProgress = true;

        for (const player of this.players) {
            player.reset();
            // Mark eliminated players as folded so they can't participate
            if (player.chips <= 0) {
                player.folded = true;
            }
        }

        // Move dealer button
        do {
            this.dealerIndex = (this.dealerIndex + 1) % 5;
        } while (this.players[this.dealerIndex].chips <= 0);

        // Post blinds
        this.postBlinds();

        // Deal hole cards
        this.dealHoleCards();

        // Set first player to act (after big blind)
        this.currentPlayerIndex = this.getNextActivePlayer((this.dealerIndex + 3) % 5);

        document.getElementById('next-hand-btn').style.display = 'none';
        document.getElementById('new-game-btn').style.display = 'none';

        this.updateUI();
        this.showMessage('New hand started. Your turn to act.', 'action-message');

        // If human is not first, let AI play
        if (!this.players[this.currentPlayerIndex].isHuman) {
            setTimeout(() => this.aiTurn(), 1000);
        }
    }

    postBlinds() {
        // Small blind
        let sbIndex = this.getNextActivePlayer((this.dealerIndex + 1) % 5);
        const sbAmount = this.players[sbIndex].bet(this.smallBlind);
        this.pot += sbAmount;

        // Big blind
        let bbIndex = this.getNextActivePlayer((sbIndex + 1) % 5);
        const bbAmount = this.players[bbIndex].bet(this.bigBlind);
        this.pot += bbAmount;

        this.currentBet = this.bigBlind;
    }

    dealHoleCards() {
        for (const player of this.players) {
            // Only deal to players with chips
            if (player.chips > 0) {
                player.holeCards = [this.deck.deal(), this.deck.deal()];
            }
        }
    }

    getNextActivePlayer(startIndex) {
        let index = startIndex;
        for (let i = 0; i < 5; i++) {
            const player = this.players[index];
            // Player is active if not folded and has chips
            if (!player.folded && player.chips > 0) {
                return index;
            }
            index = (index + 1) % 5;
        }
        return startIndex; // Fallback to start index
    }

    getActivePlayers() {
        return this.players.filter(p => !p.folded && (p.chips > 0 || p.allIn || p.currentBet > 0));
    }

    playerAction(action) {
        if (!this.handInProgress) return;

        const player = this.players[this.currentPlayerIndex];
        if (!player.isHuman) return;

        this.executeAction(player, action);
    }

    executeAction(player, action, raiseAmount = 0) {
        const callAmount = this.currentBet - player.currentBet;

        // Track human player actions for AI exploitation
        if (player.isHuman) {
            this.trackHumanAction(action, callAmount, raiseAmount);
        }

        switch (action) {
            case 'fold':
                player.folded = true;
                this.showMessage(`${player.name} folds.`, 'action-message');
                break;

            case 'check':
                if (callAmount > 0) return; // Can't check if there's a bet
                this.showMessage(`${player.name} checks.`, 'action-message');
                break;

            case 'call':
                const betAmount = player.bet(callAmount);
                this.pot += betAmount;
                this.showMessage(`${player.name} calls $${betAmount}.`, 'action-message');
                break;

            case 'raise':
                const totalRaise = player.bet(raiseAmount - player.currentBet);
                this.pot += totalRaise;
                this.minRaise = raiseAmount - this.currentBet;
                this.currentBet = raiseAmount;
                // Reset hasActed for all other players
                for (const p of this.players) {
                    if (p !== player && !p.folded && !p.allIn) {
                        p.hasActed = false;
                    }
                }
                this.showMessage(`${player.name} raises to $${raiseAmount}.`, 'action-message');
                break;

            case 'allin':
                const allInAmount = player.chips + player.currentBet;
                const allInBet = player.bet(player.chips);
                this.pot += allInBet;
                if (allInAmount > this.currentBet) {
                    this.minRaise = Math.max(this.minRaise, allInAmount - this.currentBet);
                    this.currentBet = allInAmount;
                    for (const p of this.players) {
                        if (p !== player && !p.folded && !p.allIn) {
                            p.hasActed = false;
                        }
                    }
                }
                this.showMessage(`${player.name} goes all-in for $${allInAmount}!`, 'action-message');
                break;
        }

        player.hasActed = true;
        this.updateUI();
        this.nextPlayer();
    }

    nextPlayer() {
        // Check if only one player remains - run out cards and show all hands
        // Must have hole cards to be considered in the hand
        const playersInHand = this.players.filter(p => !p.folded && p.holeCards.length === 2);

        if (playersInHand.length === 1) {
            // Everyone else folded - run out the board and show cards
            this.runOutBoard(playersInHand[0]);
            return;
        }

        if (playersInHand.length === 0) {
            // Edge case - no valid players, shouldn't happen
            return;
        }

        // Check if betting round is complete
        const playersToAct = this.players.filter(p =>
            !p.folded &&
            !p.allIn &&
            p.chips > 0 &&
            p.holeCards.length === 2 &&
            (!p.hasActed || p.currentBet < this.currentBet)
        );

        if (playersToAct.length === 0) {
            this.nextPhase();
            return;
        }

        // Move to next player
        let nextIndex = (this.currentPlayerIndex + 1) % 5;
        for (let i = 0; i < 5; i++) {
            const player = this.players[nextIndex];
            if (!player.folded && !player.allIn && player.chips > 0 && player.holeCards.length === 2) {
                this.currentPlayerIndex = nextIndex;
                this.updateUI();

                if (!player.isHuman) {
                    setTimeout(() => this.aiTurn(), 800);
                }
                return;
            }
            nextIndex = (nextIndex + 1) % 5;
        }

        // All players are all-in or folded
        this.nextPhase();
    }

    nextPhase() {
        // Reset bets for new round
        for (const player of this.players) {
            player.currentBet = 0;
            player.hasActed = false;
        }
        this.currentBet = 0;
        this.minRaise = this.bigBlind;

        const phases = ['preflop', 'flop', 'turn', 'river', 'showdown'];
        const currentIndex = phases.indexOf(this.phase);

        if (currentIndex < 4) {
            this.phase = phases[currentIndex + 1];

            switch (this.phase) {
                case 'flop':
                    this.communityCards.push(this.deck.deal(), this.deck.deal(), this.deck.deal());
                    this.showMessage('Flop dealt.', 'action-message');
                    break;
                case 'turn':
                    this.communityCards.push(this.deck.deal());
                    this.showMessage('Turn dealt.', 'action-message');
                    break;
                case 'river':
                    this.communityCards.push(this.deck.deal());
                    this.showMessage('River dealt.', 'action-message');
                    break;
                case 'showdown':
                    this.showdown();
                    return;
            }

            // Check if all remaining players are all-in
            const canAct = this.players.filter(p => !p.folded && !p.allIn && p.chips > 0);
            if (canAct.length <= 1) {
                // Run out remaining cards
                setTimeout(() => this.nextPhase(), 1000);
                this.updateUI();
                return;
            }

            // Set first player to act (first active after dealer)
            this.currentPlayerIndex = this.getNextActivePlayer((this.dealerIndex + 1) % 5);
            this.updateUI();

            if (!this.players[this.currentPlayerIndex].isHuman) {
                setTimeout(() => this.aiTurn(), 1000);
            }
        }
    }

    runOutBoard(winner) {
        // Deal remaining community cards with delay
        this.handInProgress = false;

        const dealRemaining = () => {
            if (this.communityCards.length < 5) {
                if (this.communityCards.length === 0) {
                    // Deal flop
                    this.communityCards.push(this.deck.deal(), this.deck.deal(), this.deck.deal());
                } else {
                    // Deal turn or river
                    this.communityCards.push(this.deck.deal());
                }
                this.updateUI();
                setTimeout(dealRemaining, 600);
            } else {
                // All cards dealt - show final result
                this.endHandWithReveal(winner);
            }
        };

        setTimeout(dealRemaining, 400);
    }

    endHandWithReveal(winner) {
        // Distribute pot to winner
        winner.chips += this.pot;

        // Build message
        const verb = winner.name === 'You' ? 'win' : 'wins';
        const hand = HandEvaluator.evaluate(winner.holeCards, this.communityCards);
        let message = `${winner.name} ${verb} $${this.pot} with ${hand.rank.name}! (Everyone else folded)`;

        // Show player's hand even if they folded
        const human = this.players[0];
        if (human.folded && human.holeCards.length === 2 && this.communityCards.length === 5) {
            const humanHand = HandEvaluator.evaluate(human.holeCards, this.communityCards);
            message += ` (You had ${humanHand.rank.name})`;
        }

        this.showMessage(message, 'win-message');

        // Show ALL players' cards (including folded)
        this.revealAllCards = true;
        this.updateUI();
        this.revealAllCards = false;

        // Highlight winner
        document.getElementById(`player-${winner.id}`).classList.add('winner');

        // Check if game is over
        const playersWithChips = this.players.filter(p => p.chips > 0);
        if (playersWithChips.length <= 1) {
            const champion = playersWithChips[0];
            if (champion) {
                this.showMessage(`${champion.name} ${champion.name === 'You' ? 'win' : 'wins'} the game!`, 'win-message');
            }
            document.getElementById('next-hand-btn').style.display = 'none';
        } else {
            document.getElementById('next-hand-btn').style.display = 'inline-block';
        }
        document.getElementById('new-game-btn').style.display = 'inline-block';
    }

    showdown() {
        // Only players with hole cards can contend
        const contenders = this.players.filter(p => !p.folded && p.holeCards.length === 2);

        // Evaluate hands
        const results = contenders.map(player => {
            const hand = HandEvaluator.evaluate(player.holeCards, this.communityCards);
            return { player, hand };
        });

        // Sort by hand value (best first)
        results.sort((a, b) => b.hand.rank.value - a.hand.rank.value);

        // Calculate and distribute side pots
        this.distributePots(results);
    }

    calculateSidePots() {
        // Get all players who contributed to the pot (including folded players)
        const contributors = this.players
            .filter(p => p.totalContribution > 0)
            .sort((a, b) => a.totalContribution - b.totalContribution);

        const pots = [];
        let processedAmount = 0;

        for (let i = 0; i < contributors.length; i++) {
            const player = contributors[i];
            const contribution = player.totalContribution;

            if (contribution > processedAmount) {
                // Calculate pot amount: (this level - previous level) * number of players at or above this level
                const potAmount = (contribution - processedAmount) * (contributors.length - i);
                // Eligible players are those who contributed at least this much and haven't folded
                const eligible = contributors
                    .slice(i)
                    .filter(p => !p.folded && p.holeCards.length === 2);

                if (potAmount > 0 && eligible.length > 0) {
                    pots.push({
                        amount: potAmount,
                        eligible: eligible
                    });
                }
                processedAmount = contribution;
            }
        }

        return pots;
    }

    distributePots(results) {
        const pots = this.calculateSidePots();
        const winnings = new Map(); // Track winnings per player
        let totalDistributed = 0;

        for (const pot of pots) {
            // Find the best hand among eligible players for this pot
            const eligibleResults = results.filter(r => pot.eligible.includes(r.player));

            if (eligibleResults.length === 0) continue;

            const bestValue = eligibleResults[0].hand.rank.value;
            const potWinners = eligibleResults
                .filter(r => r.hand.rank.value === bestValue)
                .map(r => r.player);

            // Split this pot among winners
            const share = Math.floor(pot.amount / potWinners.length);
            for (const winner of potWinners) {
                const current = winnings.get(winner) || 0;
                winnings.set(winner, current + share);
                totalDistributed += share;
            }
        }

        // Award winnings to players
        for (const [player, amount] of winnings) {
            player.chips += amount;
        }

        // Track showdown for AI learning
        this.trackShowdownResult(results);

        // Find overall winners for display message
        const bestValue = results[0].hand.rank.value;
        const overallWinners = results.filter(r => r.hand.rank.value === bestValue).map(r => r.player);

        this.endHandDisplay(overallWinners, results, winnings);
    }

    endHandDisplay(winners, results, winnings) {
        this.handInProgress = false;

        // Build message showing pot distribution
        let message = '';
        if (results && winners.length > 0) {
            const winnerResult = results.find(r => r.player === winners[0]);
            const totalWon = winnings.get(winners[0]) || 0;

            if (winners.length === 1) {
                const verb = winners[0].name === 'You' ? 'win' : 'wins';
                message = `${winners[0].name} ${verb} $${totalWon} with ${winnerResult.hand.rank.name}!`;
            } else {
                const names = winners.map(w => w.name).join(' and ');
                const amounts = winners.map(w => `${w.name}: $${winnings.get(w) || 0}`).join(', ');
                message = `${names} win with ${winnerResult.hand.rank.name}! (${amounts})`;
            }
        }

        // Show player's hand even if they folded
        const human = this.players[0];
        if (human.folded && human.holeCards.length === 2 && this.communityCards.length === 5) {
            const humanHand = HandEvaluator.evaluate(human.holeCards, this.communityCards);
            message += ` (You had ${humanHand.rank.name})`;
        }

        this.showMessage(message, 'win-message');

        // Show all cards
        this.revealAllCards = true;
        this.updateUI();
        this.revealAllCards = false;

        // Highlight winners
        for (const winner of winners) {
            document.getElementById(`player-${winner.id}`).classList.add('winner');
        }

        this.checkGameOver();
    }

    endHand(winners, results = null) {
        this.handInProgress = false;

        // Distribute pot (used when everyone folds - no side pots needed)
        const share = Math.floor(this.pot / winners.length);
        for (const winner of winners) {
            winner.chips += share;
        }

        // Build message
        let message = '';
        if (winners.length === 1) {
            const verb = winners[0].name === 'You' ? 'win' : 'wins';
            message = `${winners[0].name} ${verb} $${this.pot}! (Everyone else folded)`;
        }

        // Show player's hand even if they folded
        const human = this.players[0];
        if (human.folded && human.holeCards.length === 2 && this.communityCards.length === 5) {
            const humanHand = HandEvaluator.evaluate(human.holeCards, this.communityCards);
            message += ` (You had ${humanHand.rank.name})`;
        }

        this.showMessage(message, 'win-message');

        // Show all cards
        this.revealAllCards = true;
        this.updateUI();
        this.revealAllCards = false;

        // Highlight winners
        for (const winner of winners) {
            document.getElementById(`player-${winner.id}`).classList.add('winner');
        }

        this.checkGameOver();
    }

    checkGameOver() {
        // Check if game is over (only one player with chips)
        const playersWithChips = this.players.filter(p => p.chips > 0);
        if (playersWithChips.length <= 1) {
            // Game over - show only new game button
            const champion = playersWithChips[0];
            if (champion) {
                this.showMessage(`${champion.name} ${champion.name === 'You' ? 'win' : 'wins'} the game!`, 'win-message');
            }
            document.getElementById('next-hand-btn').style.display = 'none';
        } else {
            // More hands to play
            document.getElementById('next-hand-btn').style.display = 'inline-block';
        }
        document.getElementById('new-game-btn').style.display = 'inline-block';
    }

    // Track human player actions for AI to learn from
    trackHumanAction(action, callAmount, raiseAmount) {
        const stats = this.playerStats;

        // Track fold to aggression (folding when facing a raise)
        if (action === 'fold' && callAmount > this.bigBlind) {
            stats.facedAggression++;
            stats.foldToAggression++;
        } else if (callAmount > this.bigBlind && (action === 'call' || action === 'raise' || action === 'allin')) {
            stats.facedAggression++;
        }

        // Track preflop raising tendencies
        if (this.phase === 'preflop') {
            stats.preflopOpportunities++;
            if (action === 'raise' || action === 'allin') {
                stats.preflopRaises++;
            }
        }

        // Store bet sizing for later correlation with hand strength
        if (action === 'raise' || action === 'allin') {
            const human = this.players[0];
            const betSize = action === 'allin' ? human.chips + human.currentBet : raiseAmount;
            // We'll correlate this with hand strength at showdown
            human.lastBigBet = { amount: betSize, phase: this.phase };
        }
    }

    // Track showdown results to learn player tendencies
    trackShowdownResult(results) {
        const human = this.players[0];
        const stats = this.playerStats;

        // Only track if human went to showdown (didn't fold)
        if (human.folded || human.holeCards.length !== 2) return;

        stats.showdowns++;

        const humanResult = results.find(r => r.player === human);
        if (!humanResult) return;

        const handStrength = humanResult.hand.rank.value / 9000000; // Normalize to 0-1

        // Check if they made a big bet with this hand
        if (human.lastBigBet) {
            const betRatio = human.lastBigBet.amount / (this.pot - human.lastBigBet.amount);
            stats.avgBetStrength.push({ betSize: betRatio, handStrength });

            // Classify as bluff or value
            if (handStrength < 0.3 && betRatio > 0.5) {
                stats.bluffsRevealed++;
            } else if (handStrength > 0.5 && betRatio > 0.5) {
                stats.valueRevealed++;
            }

            // Track all-in tendencies
            if (human.allIn) {
                if (handStrength < 0.35) {
                    stats.allInBluffs++;
                } else {
                    stats.allInValue++;
                }
            }
        }
    }

    // Calculate player tendencies for AI to use
    getPlayerTendencies() {
        const stats = this.playerStats;
        return {
            // How often they fold to aggression (0-1, higher = folds more)
            foldToAggressionRate: stats.facedAggression > 0
                ? stats.foldToAggression / stats.facedAggression
                : 0.5,
            // How often they bluff vs value bet (0-1, higher = more bluffs)
            bluffRate: (stats.bluffsRevealed + stats.valueRevealed) > 0
                ? stats.bluffsRevealed / (stats.bluffsRevealed + stats.valueRevealed)
                : 0.3,
            // How often they all-in bluff
            allInBluffRate: (stats.allInBluffs + stats.allInValue) > 0
                ? stats.allInBluffs / (stats.allInBluffs + stats.allInValue)
                : 0.3,
            // Preflop aggression
            preflopRaiseRate: stats.preflopOpportunities > 0
                ? stats.preflopRaises / stats.preflopOpportunities
                : 0.3,
            // Sample size (more data = more confident)
            sampleSize: stats.showdowns
        };
    }

    aiTurn() {
        if (!this.handInProgress) return;

        const player = this.players[this.currentPlayerIndex];
        if (player.isHuman || player.folded || player.allIn) return;

        const callAmount = this.currentBet - player.currentBet;

        // Evaluate actual hand strength based on current phase
        const handStrength = this.evaluateHandStrength(player);

        // Get style-based decision
        const decision = this.getStyledDecision(player, handStrength, callAmount);

        if (decision.action === 'raise') {
            const raiseAmount = this.calculateRaiseAmount(player, handStrength, decision.sizing);
            if (raiseAmount > this.currentBet) {
                this.executeAction(player, 'raise', raiseAmount);
            } else {
                this.executeAction(player, 'call');
            }
        } else if (decision.action === 'allin') {
            this.executeAction(player, 'allin');
        } else {
            this.executeAction(player, decision.action);
        }
    }

    evaluateHandStrength(player) {
        const holeCards = player.holeCards;

        // Preflop evaluation
        if (this.communityCards.length === 0) {
            return this.evaluatePreflop(holeCards);
        }

        // Post-flop: use actual hand evaluation
        const hand = HandEvaluator.evaluate(holeCards, this.communityCards);
        const rankName = hand.rank.name;

        // Convert hand rank to strength (0-1)
        const rankStrengths = {
            'Royal Flush': 1.0,
            'Straight Flush': 0.98,
            'Four of a Kind': 0.95,
            'Full House': 0.90,
            'Flush': 0.82,
            'Straight': 0.75,
            'Three of a Kind': 0.65,
            'Two Pair': 0.50,
            'One Pair': 0.35,
            'High Card': 0.15
        };

        let strength = rankStrengths[rankName] || 0.15;

        // Adjust based on kicker quality for pairs
        if (rankName === 'One Pair' || rankName === 'High Card') {
            const highCard = Math.max(holeCards[0].value, holeCards[1].value);
            strength += (highCard - 10) * 0.02; // Boost for high cards
        }

        // Add slight randomness
        strength += (Math.random() - 0.5) * 0.08;

        return Math.max(0, Math.min(1, strength));
    }

    evaluatePreflop(cards) {
        const [c1, c2] = cards;
        const v1 = c1.value;
        const v2 = c2.value;
        const suited = c1.suit === c2.suit;
        const pair = v1 === v2;
        const high = Math.max(v1, v2);
        const low = Math.min(v1, v2);
        const gap = high - low;

        let strength = 0;

        if (pair) {
            // Pocket pairs
            if (v1 >= 12) strength = 0.85 + (v1 - 12) * 0.05; // QQ+ is premium
            else if (v1 >= 9) strength = 0.65 + (v1 - 9) * 0.05; // 99-JJ
            else strength = 0.45 + (v1 - 2) * 0.025; // 22-88
        } else {
            // Base strength from card values
            strength = (high + low) / 56;

            if (suited) strength += 0.08;
            if (gap === 1) strength += 0.08; // Connectors
            else if (gap === 2) strength += 0.04;

            // Premium hands
            if (high === 14) { // Ace high
                if (low >= 12) strength = 0.80; // AK, AQ
                else if (low >= 10) strength = 0.65; // AJ, AT
                else if (suited) strength = 0.55; // Axs
                else strength = 0.40;
            } else if (high === 13 && low >= 11) {
                strength = 0.60; // KQ, KJ
            }
        }

        return Math.max(0, Math.min(1, strength));
    }

    getStyledDecision(player, handStrength, callAmount) {
        const style = player.style;
        const potOdds = callAmount / (this.pot + callAmount);
        const isLatePosition = this.currentPlayerIndex > this.dealerIndex;
        const rand = Math.random();

        // Get human player tendencies for exploitation
        const tendencies = this.getPlayerTendencies();

        switch (style) {
            case 'aggressive':
                return this.aggressiveDecision(handStrength, callAmount, potOdds, rand, tendencies);
            case 'tight':
                return this.tightDecision(handStrength, callAmount, potOdds, rand, tendencies);
            case 'loose':
                return this.looseDecision(handStrength, callAmount, potOdds, rand, tendencies);
            case 'tricky':
                return this.trickyDecision(handStrength, callAmount, potOdds, rand, isLatePosition, tendencies);
            default:
                return { action: 'fold', sizing: 0 };
        }
    }

    aggressiveDecision(strength, callAmount, potOdds, rand, tendencies) {
        // Aggressive: bets and raises frequently, applies pressure
        // Exploit: bluff more if player folds to aggression often
        const bluffMore = tendencies.sampleSize >= 3 && tendencies.foldToAggressionRate > 0.5;

        if (callAmount === 0) {
            if (strength > 0.25 || rand > 0.7) {
                return { action: 'raise', sizing: rand > 0.5 ? 'big' : 'medium' };
            }
            // Bluff more against tight/foldy players
            if (bluffMore && rand > 0.5) {
                return { action: 'raise', sizing: 'medium' };
            }
            return { action: 'check' };
        } else {
            if (strength > 0.70) {
                // Monster hand - raise big or go all-in
                if (rand > 0.6) return { action: 'allin' };
                return { action: 'raise', sizing: 'big' };
            } else if (strength > 0.45) {
                // Good hand - raise often
                if (rand > 0.4) return { action: 'raise', sizing: 'medium' };
                return { action: 'call' };
            } else if (strength > 0.25) {
                // Marginal - sometimes bluff raise
                if (rand > 0.75) return { action: 'raise', sizing: 'small' };
                if (rand > 0.4 || callAmount <= this.bigBlind * 3) return { action: 'call' };
                return { action: 'fold' };
            } else {
                // Weak - bluff more against foldy players
                const bluffThreshold = bluffMore ? 0.65 : 0.85;
                if (rand > bluffThreshold) return { action: 'raise', sizing: 'big' };
                return { action: 'fold' };
            }
        }
    }

    tightDecision(strength, callAmount, potOdds, rand, tendencies) {
        // Tight: only plays premium hands, but plays them strong
        // Exploit: call more against players who bluff a lot
        const callMoreBluffs = tendencies.sampleSize >= 3 && tendencies.bluffRate > 0.4;

        if (callAmount === 0) {
            if (strength > 0.60) {
                return { action: 'raise', sizing: 'medium' };
            } else if (strength > 0.40) {
                if (rand > 0.6) return { action: 'raise', sizing: 'small' };
                return { action: 'check' };
            }
            return { action: 'check' };
        } else {
            if (strength > 0.75) {
                // Very strong - raise or all-in
                if (rand > 0.5) return { action: 'allin' };
                return { action: 'raise', sizing: 'big' };
            } else if (strength > 0.55) {
                // Strong - raise
                return { action: 'raise', sizing: 'medium' };
            } else if (strength > 0.40) {
                // Decent - call if price is right
                if (callAmount <= this.bigBlind * 4) return { action: 'call' };
                return { action: 'fold' };
            } else if (callMoreBluffs && strength > 0.25) {
                // Call lighter against known bluffers
                if (callAmount <= this.bigBlind * 3) return { action: 'call' };
                return { action: 'fold' };
            } else {
                // Not worth it
                return { action: 'fold' };
            }
        }
    }

    looseDecision(strength, callAmount, potOdds, rand, tendencies) {
        // Loose: plays many hands, calls too much, rarely folds
        // Exploit: call all-ins lighter if player bluffs all-ins often
        const callAllInLight = tendencies.sampleSize >= 3 && tendencies.allInBluffRate > 0.35;

        if (callAmount === 0) {
            if (strength > 0.50) {
                return { action: 'raise', sizing: 'small' };
            } else if (rand > 0.7) {
                return { action: 'raise', sizing: 'small' };
            }
            return { action: 'check' };
        } else {
            if (strength > 0.60) {
                // Good hand - raise
                return { action: 'raise', sizing: rand > 0.5 ? 'medium' : 'small' };
            } else if (strength > 0.30) {
                // Call almost anything
                if (callAmount <= this.bigBlind * 6 || rand > 0.3) return { action: 'call' };
                return { action: 'call' };
            } else if (callAllInLight && strength > 0.20) {
                // Call all-ins with weaker hands if player bluffs all-ins a lot
                return { action: 'call' };
            } else {
                // Even weak hands get called sometimes
                if (callAmount <= this.bigBlind * 2 || rand > 0.5) return { action: 'call' };
                return { action: 'fold' };
            }
        }
    }

    trickyDecision(strength, callAmount, potOdds, rand, isLatePosition, tendencies) {
        // Tricky: mixes up play, slow-plays monsters, bluffs with nothing
        // Diana is the best at exploiting tendencies
        const hasData = tendencies.sampleSize >= 3;
        const playerFoldsALot = hasData && tendencies.foldToAggressionRate > 0.5;
        const playerBluffsALot = hasData && tendencies.bluffRate > 0.4;
        const playerAllInBluffs = hasData && tendencies.allInBluffRate > 0.35;

        if (callAmount === 0) {
            if (strength > 0.80) {
                // Monster - sometimes slow play
                if (rand > 0.5) return { action: 'check' }; // Trap
                return { action: 'raise', sizing: 'small' };
            } else if (strength > 0.45) {
                if (rand > 0.4) return { action: 'raise', sizing: rand > 0.7 ? 'big' : 'medium' };
                return { action: 'check' };
            } else if (playerFoldsALot && rand > 0.4) {
                // Exploit foldy players with more bluffs
                return { action: 'raise', sizing: 'big' };
            } else if (rand > 0.75 && isLatePosition) {
                // Position bluff
                return { action: 'raise', sizing: 'medium' };
            }
            return { action: 'check' };
        } else {
            if (strength > 0.80) {
                // Monster - mix between call (slow play) and raise
                if (rand > 0.4) return { action: 'call' }; // Trap
                return { action: 'raise', sizing: 'big' };
            } else if (strength > 0.55) {
                if (rand > 0.5) return { action: 'raise', sizing: 'medium' };
                return { action: 'call' };
            } else if (strength > 0.30) {
                // Float or fold randomly - but call more against bluffers
                const callThreshold = playerBluffsALot ? 0.3 : 0.45;
                if (rand > callThreshold) return { action: 'call' };
                return { action: 'fold' };
            } else if (playerAllInBluffs && strength > 0.20) {
                // Call all-ins light against known all-in bluffers
                if (rand > 0.4) return { action: 'call' };
                return { action: 'fold' };
            } else {
                // Sometimes big bluff - more often against foldy players
                const bluffThreshold = playerFoldsALot ? 0.6 : 0.88;
                if (rand > bluffThreshold) return { action: 'raise', sizing: 'big' };
                if (rand > 0.75 && callAmount <= this.bigBlind * 2) return { action: 'call' };
                return { action: 'fold' };
            }
        }
    }

    calculateRaiseAmount(player, handStrength, sizing) {
        const minRaise = this.currentBet + this.minRaise;
        const maxRaise = player.chips + player.currentBet;

        let raiseAmount;
        switch (sizing) {
            case 'small':
                raiseAmount = this.currentBet + this.pot * 0.4 + Math.random() * this.pot * 0.2;
                break;
            case 'medium':
                raiseAmount = this.currentBet + this.pot * 0.7 + Math.random() * this.pot * 0.3;
                break;
            case 'big':
                raiseAmount = this.currentBet + this.pot * 1.2 + Math.random() * this.pot * 0.5;
                break;
            default:
                raiseAmount = minRaise;
        }

        raiseAmount = Math.floor(raiseAmount);
        raiseAmount = Math.max(minRaise, Math.min(maxRaise, raiseAmount));

        return raiseAmount;
    }

    showRaiseControls() {
        const player = this.players[0];
        const minRaise = this.currentBet + this.minRaise;
        const maxRaise = player.chips + player.currentBet;

        const slider = document.getElementById('raise-slider');
        const input = document.getElementById('raise-input');

        slider.min = minRaise;
        slider.max = maxRaise;
        slider.value = minRaise;
        input.min = minRaise;
        input.max = maxRaise;
        input.value = minRaise;

        document.getElementById('raise-controls').style.display = 'block';
    }

    hideRaiseControls() {
        document.getElementById('raise-controls').style.display = 'none';
    }

    confirmRaise() {
        const raiseAmount = parseInt(document.getElementById('raise-input').value);
        this.hideRaiseControls();
        this.executeAction(this.players[0], 'raise', raiseAmount);
    }

    showMessage(text, className = '') {
        const area = document.getElementById('message-area');
        area.innerHTML = `<span class="${className}">${text}</span>`;
    }

    updateUI() {
        // Update pot
        document.getElementById('pot').textContent = this.pot;

        // Update community cards
        const slots = ['flop1', 'flop2', 'flop3', 'turn', 'river'];
        for (let i = 0; i < 5; i++) {
            const slot = document.getElementById(slots[i]);
            if (i < this.communityCards.length) {
                const card = this.communityCards[i];
                slot.className = `card-slot has-card ${card.suit} dealing`;
                slot.innerHTML = `<span class="card-rank">${card.displayRank}</span><span class="card-suit">${card.suitSymbol}</span>`;
            } else {
                slot.className = 'card-slot';
                slot.innerHTML = '';
            }
        }

        // Update players
        for (let i = 0; i < 5; i++) {
            const player = this.players[i];
            const elem = document.getElementById(`player-${i}`);

            elem.classList.remove('active', 'folded', 'winner');

            if (player.folded) {
                elem.classList.add('folded');
            }

            if (this.handInProgress && i === this.currentPlayerIndex && !player.folded && !player.allIn) {
                elem.classList.add('active');
            }

            // Chips and bet
            elem.querySelector('.chip-count').textContent = player.chips;
            elem.querySelector('.bet-amount').textContent = player.currentBet;

            // Dealer button
            const dealerBtn = elem.querySelector('.dealer-btn');
            dealerBtn.style.display = (i === this.dealerIndex && this.gameStarted) ? 'inline-block' : 'none';

            // Hole cards
            const holeSlots = elem.querySelectorAll('.player-cards .card-slot');
            if (player.holeCards.length === 2) {
                const showCards = player.isHuman || this.revealAllCards || (!player.folded && !this.handInProgress);
                for (let j = 0; j < 2; j++) {
                    if (showCards) {
                        // Show cards for human player (even if folded) or during reveal
                        const card = player.holeCards[j];
                        holeSlots[j].className = `card-slot has-card ${card.suit}`;
                        holeSlots[j].innerHTML = `<span class="card-rank">${card.displayRank}</span><span class="card-suit">${card.suitSymbol}</span>`;
                    } else if (!player.folded) {
                        // Show card backs for non-folded opponents
                        holeSlots[j].className = 'card-slot card-back';
                        holeSlots[j].innerHTML = '';
                    } else {
                        // Hide cards for folded opponents
                        holeSlots[j].className = 'card-slot';
                        holeSlots[j].innerHTML = '';
                    }
                }
            } else {
                holeSlots.forEach(s => {
                    s.className = 'card-slot';
                    s.innerHTML = '';
                });
            }

            // Status
            const status = elem.querySelector('.player-status');
            if (player.folded) {
                status.textContent = 'FOLDED';
            } else if (player.allIn) {
                status.textContent = 'ALL-IN';
                status.style.color = '#ffd700';
            } else if (player.chips <= 0 && !this.handInProgress) {
                status.textContent = 'OUT';
            } else {
                status.textContent = '';
            }
        }

        // Update controls
        this.updateControls();
    }

    updateControls() {
        const player = this.players[0];
        const isMyTurn = this.handInProgress && this.currentPlayerIndex === 0 && !player.folded && !player.allIn;
        const callAmount = this.currentBet - player.currentBet;

        const foldBtn = document.getElementById('fold-btn');
        const checkBtn = document.getElementById('check-btn');
        const callBtn = document.getElementById('call-btn');
        const raiseBtn = document.getElementById('raise-btn');
        const allinBtn = document.getElementById('allin-btn');

        foldBtn.disabled = !isMyTurn;
        checkBtn.disabled = !isMyTurn || callAmount > 0;
        callBtn.disabled = !isMyTurn || callAmount === 0;
        raiseBtn.disabled = !isMyTurn || player.chips <= callAmount;
        allinBtn.disabled = !isMyTurn;

        document.getElementById('call-amount').textContent = Math.min(callAmount, player.chips);
    }
}

// Start the game
const game = new PokerGame();
