"use strict";

let tree_draw_props = {

	// Since we use Object.assign(), it's bad form to have any deep objects in the props.

	ordered_nodes_cache: null,
	ordered_nodes_cache_version: -1,

	dom_easy_highlight_change: function() {

		// When the previously highlighted node and the newly highlighted node are on the same line,
		// with the same end-of-line, meaning no gray / white changes are needed.

		let dom_highlight = this.get_movelist_highlight();
		let highlight_class;

		if (dom_highlight && dom_highlight.classList.contains("movelist_highlight_yellow")) {
			highlight_class = "movelist_highlight_yellow";
		} else {
			highlight_class = "movelist_highlight_blue";
		}

		if (dom_highlight) {
			dom_highlight.classList.remove("movelist_highlight_blue");
			dom_highlight.classList.remove("movelist_highlight_yellow");
		}

		let dom_node = document.getElementById(`node_${this.node.id}`);

		if (dom_node) {
			dom_node.classList.add(highlight_class);
		}

		this.fix_scrollbar_position();
	},

	dom_from_scratch: function() {
		if (config.movelist_layout === "columns") {
			this.dom_from_scratch_columns();
		} else {
			this.dom_from_scratch_inline();
		}
	},

	dom_from_scratch_inline: function() {

		// Some prep-work (we need to undo all this at the end)...

		let line_end = this.node.get_end();

		let foo = line_end;
		while (foo) {
			foo.current_line = true;	// These nodes will be coloured white, others gray
			foo = foo.parent;
		}

		let main_line_end = this.root.get_end();
		main_line_end.main_line_end = true;

		// Begin...

		if (this.ordered_nodes_cache_version !== this.tree_version) {
			this.ordered_nodes_cache = get_ordered_nodes(this.root);
			this.ordered_nodes_cache_version = this.tree_version;
		}

		let pseudoelements = [];		// Objects containing opening span string `<span foo>` and text string

		for (let item of this.ordered_nodes_cache) {

			if (item === this.root) {
				continue;
			}

			// As a crude hack, the item can be a bracket string.
			// Deal with that first...

			if (typeof item === "string") {
				pseudoelements.push({
					opener: "",
					text: item,
					closer: ""
				});
				continue;
			}

			// So item is a real node...

			let node = item;
			let classes = [];

			if (node === this.node) {
				if (node.is_main_line()) {
					classes.push("movelist_highlight_blue");
				} else {
					classes.push("movelist_highlight_yellow");
				}
			}

			if (node.current_line) {
				classes.push("white");		// Otherwise, inherits gray colour from movelist CSS
			}

			pseudoelements.push({
				opener: `<span class="${classes.join(" ")}" id="node_${node.id}">`,
				text: node.token(),
				closer: `</span>`
			});
		}

		let all_spans = [];

		for (let n = 0; n < pseudoelements.length; n++) {

			let p = pseudoelements[n];
			let nextp = pseudoelements[n + 1];		// Possibly undefined

			if (!nextp || (p.text !== "(" && nextp.text !== ")")) {
				p.text += " ";
			}

			all_spans.push(`${p.opener}${p.text}${p.closer}`);
		}

		movelist.innerHTML = all_spans.join("");

		// Undo the damage to our tree from the start...

		foo = line_end;
		while(foo) {
			delete foo.current_line;
			foo = foo.parent;
		}

		delete main_line_end.main_line_end;

		// And finally...

		this.fix_scrollbar_position();
	},

	dom_from_scratch_columns: function() {

		// MCO-style layout: one row per fullmove, a shared move-number column at the
		// left, and a White/Black column pair per line. A variation opens in the
		// leftmost pair right of its parent line's pair that is free over the
		// variation's rows, so unrelated variations can share a pair.

		let line_end = this.node.get_end();

		let foo = line_end;
		while (foo) {
			foo.current_line = true;	// These nodes will be coloured white, others gray
			foo = foo.parent;
		}

		// Collect lines: a line is a first node plus the children[0] chain after it.
		// Variations are visited in reading order (branch point order, then sibling order).

		let lines = [];

		const walk_line = (first_node, parent_line) => {
			let nodes = [];
			let jobs = [];
			let node = first_node;
			while (true) {
				nodes.push(node);
				for (let i = 1; i < node.children.length; i++) {
					jobs.push(node.children[i]);
				}
				if (node.children.length === 0) {
					break;
				}
				node = node.children[0];
			}
			let line = {nodes: nodes, parent: parent_line, pair: null};
			lines.push(line);
			for (let job of jobs) {
				walk_line(job, line);
			}
		};

		if (this.root.children.length > 0) {
			walk_line(this.root.children[0], null);
		}

		const row_of = (node) => node.parent.board.fullmove;

		let pair_rows = [];			// pair index -> Set of occupied rows

		for (let line of lines) {
			let start = row_of(line.nodes[0]);
			let end = row_of(line.nodes[line.nodes.length - 1]);
			let p = line.parent ? line.parent.pair + 1 : 0;
			while (true) {
				if (!pair_rows[p]) {
					pair_rows[p] = new Set();
				}
				let free = true;
				for (let r = start; r <= end; r++) {
					if (pair_rows[p].has(r)) {
						free = false;
						break;
					}
				}
				if (free) {
					break;
				}
				p++;
			}
			for (let r = start; r <= end; r++) {
				pair_rows[p].add(r);
			}
			line.pair = p;
		}

		let cells = Object.create(null);	// "row_pair_colour" -> html string

		for (let line of lines) {
			let first = line.nodes[0];
			if (first.parent.board.active === "b") {
				cells[`${row_of(first)}_${line.pair}_w`] = `<span class="movelist_ellipsis">…</span>`;
			}
			for (let node of line.nodes) {
				let classes = [];
				if (node === this.node) {
					if (node.is_main_line()) {
						classes.push("movelist_highlight_blue");
					} else {
						classes.push("movelist_highlight_yellow");
					}
				}
				if (node.current_line) {
					classes.push("white");
				}
				let colour = node.parent.board.active === "w" ? "w" : "b";
				cells[`${row_of(node)}_${line.pair}_${colour}`] =
					`<span class="${classes.join(" ")}" id="node_${node.id}">${node.nice_move()}</span>`;
			}
		}

		let html_parts = [];

		if (lines.length > 0) {

			let num_pairs = pair_rows.length;
			let min_row = this.root.board.fullmove;
			let max_row = min_row;
			for (let line of lines) {
				let end = row_of(line.nodes[line.nodes.length - 1]);
				if (end > max_row) {
					max_row = end;
				}
			}

			html_parts.push(`<table class="movelist_table">`);
			for (let r = min_row; r <= max_row; r++) {
				html_parts.push(`<tr><td class="movelist_numcol">${r}.</td>`);
				for (let p = 0; p < num_pairs; p++) {
					let sep = p > 0 ? " movelist_pair_sep" : "";
					html_parts.push(`<td class="movelist_wcell${sep}">${cells[`${r}_${p}_w`] || ""}</td>`);
					html_parts.push(`<td class="movelist_bcell">${cells[`${r}_${p}_b`] || ""}</td>`);
				}
				html_parts.push(`</tr>`);
			}
			html_parts.push(`</table>`);
		}

		movelist.innerHTML = html_parts.join("");

		foo = line_end;
		while (foo) {
			delete foo.current_line;
			foo = foo.parent;
		}

		this.fix_scrollbar_position();
	},

	// Helpers...

	get_movelist_highlight: function() {
		let elements = document.getElementsByClassName("movelist_highlight_blue");
		if (elements && elements.length > 0) {
			return elements[0];
		}
		elements = document.getElementsByClassName("movelist_highlight_yellow");
		if (elements && elements.length > 0) {
			return elements[0];
		}
		return null;
	},

	fix_scrollbar_position: function() {

		let highlight = this.get_movelist_highlight();

		if (config.movelist_layout === "columns") {
			// offsetTop arithmetic breaks inside a table (the td becomes the offset
			// parent), so let the browser do it. Also scrolls horizontally.
			if (highlight) {
				highlight.scrollIntoView({block: "nearest", inline: "nearest"});
			} else {
				movelist.scrollTop = 0;
			}
			return;
		}

		if (highlight) {
			let top = highlight.offsetTop - movelist.offsetTop;
			if (top < movelist.scrollTop) {
				movelist.scrollTop = top;
			}
			let bottom = top + highlight.offsetHeight;
			if (bottom > movelist.scrollTop + movelist.offsetHeight) {
				movelist.scrollTop = bottom - movelist.offsetHeight;
			}
		} else {
			movelist.scrollTop = 0;
		}
	},
};
