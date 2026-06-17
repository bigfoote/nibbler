"use strict";

let infobox_props = {

	draw_infobox: function(node, mouse_point, active_square, active_colour, hoverdraw_div, allow_inactive_focus, lookup_object) {

		let searchmoves = node.searchmoves;

		if (this.displaying_error_log()) {
			infobox.innerHTML = this.error_log;
			this.last_drawn_version = null;
			return;
		}

		if (!node || node.destroyed) {
			return;
		}

		let info_list;

		if (node.terminal_reason()) {
			info_list = [];
		} else {
			info_list = SortedMoveInfo(node);
		}

		// A lookup_object should always have type (string) and moves (object).

		let ltype        = lookup_object ? lookup_object.type  : null;
		let lookup_moves = lookup_object ? lookup_object.moves : null;

		// If we are using an online API, and the list has some "untouched" info, we
		// may be able to sort them using the API info.

		if (ltype === "chessdbcn" || ltype === "lichess_masters" || ltype === "lichess_plebs") {

			let touched_list = [];
			let untouched_list = [];

			for (let info of info_list) {
				if (info.__touched) {
					touched_list.push(info);
				} else {
					untouched_list.push(info);
				}
			}

			const a_is_best = -1;
			const b_is_best = 1;

			untouched_list.sort((a, b) => {
				if (lookup_moves[a.move] && !lookup_moves[b.move]) return a_is_best;
				if (!lookup_moves[a.move] && lookup_moves[b.move]) return b_is_best;
				if (!lookup_moves[a.move] && !lookup_moves[b.move]) return 0;
				return lookup_moves[b.move].sort_score() - lookup_moves[a.move].sort_score();
			});

			info_list = touched_list.concat(untouched_list);
		}

		let best_subcycle = info_list.length > 0 ? info_list[0].subcycle : 0;
		if (best_subcycle === 0) {		// Because all info was autopopulated
			best_subcycle = -1;			// Causes all info to be gray
		}

		if (typeof config.max_info_lines === "number" && config.max_info_lines > 0) {		// Hidden option, request of rwbc
			info_list = info_list.slice(0, config.max_info_lines);
		}

		// We might be highlighting some div...

		let highlight_move = null;
		let highlight_class = null;

		// We'll highlight it if it's a valid OCM *and* clicking there now would make it happen...

		if (mouse_point && this.one_click_moves[mouse_point.x][mouse_point.y]) {
			if (!active_square || this.one_click_moves[mouse_point.x][mouse_point.y].slice(0, 2) === active_square.s) {
				highlight_move = this.one_click_moves[mouse_point.x][mouse_point.y];
				highlight_class = "ocm_highlight";
			}
		}

		if (typeof hoverdraw_div === "number" && hoverdraw_div >= 0 && hoverdraw_div < info_list.length) {
			highlight_move = info_list[hoverdraw_div].move;
			highlight_class = "hover_highlight";
		}

		// We cannot skip the draw if...

		let no_skip_reasons = [];

		if (node.id !== this.last_drawn_node_id)                                no_skip_reasons.push("node");
		if (node.table.version !== this.last_drawn_version)                     no_skip_reasons.push("table version");
		if (highlight_move !== this.last_drawn_highlight_move)                  no_skip_reasons.push("highlight move");
		if (highlight_class !== this.last_drawn_highlight_class)                no_skip_reasons.push("highlight class");
		if (info_list.length !== this.last_drawn_length)                        no_skip_reasons.push("info list length");
		if (allow_inactive_focus !== this.last_drawn_allow_inactive_focus)      no_skip_reasons.push("allow inactive focus");
		if (CompareArrays(searchmoves, this.last_drawn_searchmoves) === false)  no_skip_reasons.push("searchmoves");
		if (lookup_object !== this.last_drawn_lookup_object)                    no_skip_reasons.push("lookup object");

		draw_infobox_no_skip_reasons = no_skip_reasons.join(", ");	// For debugging only.

		if (no_skip_reasons.length === 0) {
			draw_infobox_total_skips++;
			return;
		}

		this.last_drawn_node_id = node.id;
		this.last_drawn_version = node.table.version;
		this.last_drawn_highlight_move = highlight_move;
		this.last_drawn_highlight_class = highlight_class;
		this.last_drawn_length = info_list.length;
		this.last_drawn_allow_inactive_focus = allow_inactive_focus;
		this.last_drawn_searchmoves = Array.from(searchmoves);
		this.last_drawn_lookup_object = lookup_object;

		this.info_clickers = [];
		this.info_clickers_node_id = node.id;

		// Adaptive WDL bars: use the two-column (bar + body) layout only when the bar
		// feature is on AND at least one candidate in this list actually has WDL data.
		// Otherwise fall back to the classic inline layout so non-WDL engines (or
		// positions) don't get a wasted left margin on every line.

		let use_bars = config.show_wdl_bar && info_list.some(o => o.wdl_white() !== null);

		// For the confidence fade: the most-visited move's N. We dim each move's eval
		// (bar + EV number) by log(N) relative to this, since low-visit evals are noisy.

		let max_n = 0;
		for (let o of info_list) {
			if (typeof o.n === "number" && o.n > max_n) {
				max_n = o.n;
			}
		}

		let substrings = [];
		let clicker_index = 0;
		let div_index = 0;

		for (let info of info_list) {

			// The div containing the PV etc...

			let divclass = "infoline";

			if (use_bars) {
				divclass += " " + "haswdlbar";
			}

			if (info.subcycle !== best_subcycle && !config.never_grayout_infolines) {
				divclass += " " + "gray";
			}

			if (info.move === highlight_move) {
				divclass += " " + highlight_class;
			}

			substrings.push(`<div id="infoline_${div_index++}" class="${divclass}">`);

			// Confidence (0.35..1) for the eval fade, from this move's N relative to the
			// best move's N on a log scale. Untouched / zero-visit moves fade to the floor.

			let conf = 1;
			if (use_bars && max_n > 0) {
				let n = (typeof info.n === "number" && info.n > 0) ? info.n : 0;
				if (n <= 0) {
					conf = 0.18;
				} else {
					conf = 1 + 0.28 * Math.log10(n / max_n);	// -0.28 opacity per 10x fewer visits than the best move
					if (conf < 0.18) conf = 0.18;
					if (conf > 1) conf = 1;
				}
			}

			// The WDL bar (left column) and the start of the body column. The bar is
			// always White POV (fixed White / Draw / Black order); see ADR 0001...

			if (use_bars) {
				let ww = info.wdl_white();
				if (ww) {
					let sum = ww[0] + ww[1] + ww[2];
					let wpct = 100 * ww[0] / sum;
					let dpct = 100 * ww[1] / sum;
					let lpct = 100 * ww[2] / sum;
					let evpct = wpct + dpct / 2;		// White-POV expected score, for the EV tick.
					let title = `W ${wpct.toFixed(0)}%  D ${dpct.toFixed(0)}%  L ${lpct.toFixed(0)}%`;
					// Widths/colours/opacity/tick position are applied later via the CSSOM (see
					// style_wdl_bars), NOT as inline style attributes, because the page's
					// Content-Security-Policy forbids inline styles.
					substrings.push(
						`<span class="wdlbar" title="${title}" data-conf="${conf.toFixed(3)}">` +
						`<span class="wdl_w" data-pct="${wpct.toFixed(2)}"></span>` +
						`<span class="wdl_d" data-pct="${dpct.toFixed(2)}"></span>` +
						`<span class="wdl_l" data-pct="${lpct.toFixed(2)}"></span>` +
						`<span class="wdlev" data-ev="${evpct.toFixed(2)}"></span>` +
						`</span>`
					);
				} else {
					substrings.push(`<span class="wdlbar-empty"></span>`);		// Reserve the column so bodies stay aligned.
				}
				substrings.push(`<span class="infoline-body">`);
			}

			// The "focus" button...

			if (config.searchmoves_buttons) {
				if (searchmoves.includes(info.move)) {
					substrings.push(`<span id="searchmove_${info.move}" class="yellow">${config.focus_on_text} </span>`);
				} else {
					if (allow_inactive_focus) {
						substrings.push(`<span id="searchmove_${info.move}" class="gray">${config.focus_off_text} </span>`);
					}
				}
			}

			// The value...

			let value_string = "?";
			if (config.show_cp) {
				if (typeof info.mate === "number" && info.mate !== 0) {
					value_string = info.mate_string(config.cp_pov);
				} else {
					value_string = info.cp_string(config.cp_pov);
				}
			} else {
				value_string = info.value_string(1, config.ev_pov);
				if (value_string !== "?") {
					value_string += "%";
				}
			}

			let blue = info.subcycle === best_subcycle || config.never_grayout_infolines;

			if (use_bars) {
				// Tag the EV number so style_wdl_bars() can fade it to match its bar's confidence.
				substrings.push(`<span class="ev${blue ? " blue" : ""}" data-conf="${conf.toFixed(3)}">${value_string} </span>`);
			} else if (blue) {
				substrings.push(`<span class="blue">${value_string} </span>`);
			} else {
				substrings.push(`${value_string} `);
			}

			// The PV...

			let colour = active_colour;
			let movenum = node.board.fullmove;			// Only matters for config.infobox_pv_move_numbers
			let nice_pv = info.nice_pv();

			for (let i = 0; i < nice_pv.length; i++) {
				let spanclass = "";
				if (info.subcycle === best_subcycle || config.never_grayout_infolines) {
					spanclass = colour === "w" ? "white" : "pink";
				}
				if (nice_pv[i].includes("O-O")) {
					spanclass += (spanclass.length > 0) ? " nobr" : "nobr";
				}

				let numstring = "";
				if (config.infobox_pv_move_numbers) {
					if (colour === "w") {
						numstring = `${movenum}. `;
					} else if (colour === "b" && i === 0) {
						numstring = `${movenum}... `;
					}
				}

				substrings.push(`<span id="infobox_${clicker_index++}" class="${spanclass}">${numstring}${nice_pv[i]} </span>`);
				this.info_clickers.push({
					move: info.pv[i],
					is_start: i === 0,
					is_end: i === nice_pv.length - 1,
				});
				colour = OppositeColour(colour);
				if (colour === "w") {
					movenum++;
				}
			}

			// The extra stats...

			let extra_stat_strings = [];

			if (info.__touched) {

				let stats_list = info.stats_list(
					{
						n:             config.show_n,
						n_abs:         config.show_n_abs,
						depth:         config.show_depth,
						wdl:           config.show_wdl,
						wdl_pov:       config.wdl_pov,
						p:             config.show_p,
						m:             config.show_m,
						v:             config.show_v,
						q:             config.show_q,
						u:             config.show_u,
						s:             config.show_s,
					}, node.table.nodes);

				extra_stat_strings = extra_stat_strings.concat(stats_list);
			}

			if (config.looker_api) {
				let api_string = "API: ?";
				if (ltype && lookup_moves) {
					let pov = null;
					if (ltype === "chessdbcn") {
						pov = config.cp_pov;
					} else if (ltype === "lichess_masters" || ltype === "lichess_plebs") {
						pov = config.ev_pov;
					}
					let o = lookup_moves[info.move];
					if (typeof o === "object" && o !== null) {
						api_string = o.text(pov);
					}
				}
				extra_stat_strings.push(api_string);
			}

			if (extra_stat_strings.length > 0) {
				if (config.infobox_stats_newline) {
					substrings.push("<br>");
				}
				substrings.push(`<span class="gray">(${extra_stat_strings.join(', ')})</span>`);
			}

			// Close the body column (if any) and the whole div...

			if (use_bars) {
				substrings.push("</span>");
			}

			substrings.push("</div>");

		}

		infobox.innerHTML = substrings.join("");

		if (use_bars) {
			this.style_wdl_bars();
		}
	},

	style_wdl_bars: function() {

		// Apply each WDL bar segment's width and colour via the CSSOM. We can't use inline
		// style attributes in the HTML because the page's Content-Security-Policy (style-src
		// 'self') strips them; CSSOM assignments are not subject to that restriction.

		for (let bar of infobox.querySelectorAll(".wdlbar")) {
			bar.style.opacity = bar.dataset.conf;					// Confidence fade (also fades the tick, a child).
			for (let seg of bar.children) {
				if (seg.classList.contains("wdlev")) {
					seg.style.left = seg.dataset.ev + "%";			// EV tick position.
				} else {
					seg.style.width = seg.dataset.pct + "%";
					if (seg.classList.contains("wdl_w")) {
						seg.style.backgroundColor = config.graph_win_colour;
					} else if (seg.classList.contains("wdl_d")) {
						seg.style.backgroundColor = config.graph_draw_colour;
					} else {
						seg.style.backgroundColor = config.graph_loss_colour;
					}
				}
			}
		}

		for (let ev of infobox.querySelectorAll(".ev")) {			// Fade the EV number to match its bar.
			ev.style.opacity = ev.dataset.conf;
		}
	},

	must_draw_infobox: function() {
		this.last_drawn_version = null;
	},

	clickers_are_valid_for_node: function(node) {
		if (!node || !this.info_clickers_node_id) {
			return false;
		}
		return node.id === this.info_clickers_node_id;
	},

	moves_from_click_n: function(n, desired_length = null) {

		if (typeof n !== "number" || Number.isNaN(n)) {
			return [];
		}

		if (!this.info_clickers || n < 0 || n >= this.info_clickers.length) {
			return [];
		}

		let move_list = [];

		// Work backwards until we get to the start of the line...

		for (let i = n; i >= 0; i--) {
			let object = this.info_clickers[i];
			move_list.push(object.move);
			if (object.is_start) {
				break;
			}
		}

		move_list.reverse();

		// If a PV length is specified, either truncate or extend as needed...

		if (typeof desired_length === "number") {
			if (move_list.length > desired_length) {
				move_list = move_list.slice(0, desired_length);
			} else if (move_list.length < desired_length) {
				for (let i = n + 1; i < this.info_clickers.length; i++) {
					let object = this.info_clickers[i];
					if (object.is_start) {
						break;
					}
					move_list.push(object.move);					// Note the different order of stataments compared to the above.
					if (move_list.length >= desired_length) {
						break;
					}
				}
			}
		}

		return move_list;
	},

};



// For debugging...
let draw_infobox_total_skips = 0;
let draw_infobox_no_skip_reasons = "";
