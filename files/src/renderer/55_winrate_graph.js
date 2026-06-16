"use strict";

function NewGrapher() {

	let grapher = Object.create(null);

	grapher.dragging = false;			// Used by the event handlers in start.js

	grapher.clear_graph = function() {

		let boundingrect = graph.getBoundingClientRect();
		let width = window.innerWidth - boundingrect.left - 16;
		let height = boundingrect.bottom - boundingrect.top;

		// This clears the canvas...

		graph.width = width;
		graph.height = height;
	};

	grapher.draw = function(node, force) {
		if (config.graph_height <= 0) {
			return;
		}
		this.draw_everything(node);
	};

	grapher.draw_everything = function(node) {

		this.clear_graph();

		if (config.graph_type === "wdl") {
			this.draw_wdl(node);
		} else {
			this.draw_winrate(node);
		}
	};

	grapher.draw_winrate = function(node) {

		let width = graph.width;		// After clear_graph() in draw_everything().
		let height = graph.height;

		let eval_list = node.all_graph_values();
		this.draw_horizontal_lines(width, height, [1/3, 2/3]);
		this.draw_position_line(eval_list.length, node);

		// We make lists of contiguous edges that can be drawn at once...

		let runs = this.make_runs(eval_list, width, height, node.graph_length_knower.val);

		// Draw our normal runs...

		graphctx.strokeStyle = "white";
		graphctx.lineWidth = config.graph_line_width;
		graphctx.lineJoin = "round";
		graphctx.setLineDash([]);

		for (let run of runs.normal_runs) {
			graphctx.beginPath();
			graphctx.moveTo(run[0].x1, run[0].y1);
			for (let edge of run) {
				graphctx.lineTo(edge.x2, edge.y2);
			}
			graphctx.stroke();
		}

		// Draw our dashed runs...

		graphctx.strokeStyle = "#999999";
		graphctx.lineWidth = config.graph_line_width;
		graphctx.setLineDash([config.graph_line_width, config.graph_line_width]);

		for (let run of runs.dashed_runs) {
			graphctx.beginPath();
			graphctx.moveTo(run[0].x1, run[0].y1);
			for (let edge of run) {
				graphctx.lineTo(edge.x2, edge.y2);
			}
			graphctx.stroke();
		}
	};

	grapher.draw_wdl = function(node) {

		let width = graph.width;		// After clear_graph() in draw_everything().
		let height = graph.height;

		let wdl_list = node.all_graph_wdl();
		let graph_length = node.graph_length_knower.val;

		// Build contiguous runs of points that have data. Gaps (null entries) are left
		// empty rather than bridged, so the chart never invents data it doesn't have...

		let ply_width = Math.max(2, width / graph_length);

		let runs = [];
		let run = [];

		for (let n = 0; n < wdl_list.length; n++) {
			let e = wdl_list[n];
			if (e) {
				run.push({
					x: width * n / graph_length,
					y1: e[0] * height,					// White-win / draw boundary
					y2: (e[0] + e[1]) * height,			// draw / Black-win boundary
				});
			} else if (run.length > 0) {
				runs.push(run);
				run = [];
			}
		}
		if (run.length > 0) {
			runs.push(run);
		}

		// A lone point (e.g. only the current position has been analysed) can't form a
		// filled area, so give it a sliver of width so it remains visible...

		for (let run of runs) {
			if (run.length === 1) {
				let p = run[0];
				let x2 = Math.min(width, p.x + ply_width);
				run.push({x: x2, y1: p.y1, y2: p.y2});
			}
		}

		// Draw the three stacked bands, White's POV top-to-bottom: win / draw / loss...

		for (let run of runs) {
			this.fill_wdl_band(run, run.map(p => 0),     run.map(p => p.y1),   config.graph_win_colour);
			this.fill_wdl_band(run, run.map(p => p.y1),  run.map(p => p.y2),   config.graph_draw_colour);
			this.fill_wdl_band(run, run.map(p => p.y2),  run.map(p => height), config.graph_loss_colour);
		}

		// Quartile guide lines over the bands, then the position cursor line...

		this.draw_wdl_guides(width, height);
		this.draw_position_line(wdl_list.length, node);
	};

	grapher.fill_wdl_band = function(run, top_ys, bot_ys, colour) {

		if (run.length < 2) {
			return;
		}

		graphctx.fillStyle = colour;
		graphctx.beginPath();
		graphctx.moveTo(run[0].x, top_ys[0]);
		for (let i = 1; i < run.length; i++) {
			graphctx.lineTo(run[i].x, top_ys[i]);
		}
		for (let i = run.length - 1; i >= 0; i--) {
			graphctx.lineTo(run[i].x, bot_ys[i]);
		}
		graphctx.closePath();
		graphctx.fill();
	};

	grapher.draw_wdl_guides = function(width, height) {

		// Quartile reference lines. Drawn in a contrasting colour because a grey line
		// would vanish against the grey draw band and the dark loss band.

		let pixel_y_adjustment = config.graph_line_width % 2 === 0 ? 0 : -0.5;

		graphctx.strokeStyle = "rgba(102, 170, 170, 0.55)";
		graphctx.lineWidth = config.graph_line_width;
		graphctx.setLineDash([config.graph_line_width, config.graph_line_width]);

		for (let y_fraction of [0.25, 0.5, 0.75]) {
			graphctx.beginPath();
			graphctx.moveTo(0, height * y_fraction + pixel_y_adjustment);
			graphctx.lineTo(width, height * y_fraction + pixel_y_adjustment);
			graphctx.stroke();
		}
	};

	grapher.make_runs = function(eval_list, width, height, graph_length) {

		// Returns an object with 2 arrays (normal_runs and dashed_runs).
		// Each of those is an array of arrays of contiguous edges that can be drawn at once.

		let all_edges = [];

		let last_x = null;
		let last_y = null;
		let last_n = null;

		// This loop creates all edges that we are going to draw, and marks each
		// edge as dashed or not...

		for (let n = 0; n < eval_list.length; n++) {

			let e = eval_list[n];

			if (e !== null) {

				let x = width * n / graph_length;

				let y = (1 - e) * height;
				if (y < 1) y = 1;
				if (y > height - 2) y = height - 2;

				if (last_x !== null) {
					all_edges.push({
						x1: last_x,
						y1: last_y,
						x2: x,
						y2: y,
						dashed: n - last_n !== 1,
					});
				}

				last_x = x;
				last_y = y;
				last_n = n;
			}
		}

		// Now we make runs of contiguous edges that share a style...

		let normal_runs = [];
		let dashed_runs = [];

		let run = [];
		let current_meta_list = normal_runs;	// Will point at normal_runs or dashed_runs.

		for (let edge of all_edges) {
			if ((edge.dashed && current_meta_list !== dashed_runs) || (!edge.dashed && current_meta_list !== normal_runs)) {
				if (run.length > 0) {
					current_meta_list.push(run);
				}
				current_meta_list = edge.dashed ? dashed_runs : normal_runs;
				run = [];
			}
			run.push(edge);
		}
		if (run.length > 0) {
			current_meta_list.push(run);
		}

		return {normal_runs, dashed_runs};
	};

	grapher.draw_horizontal_lines = function(width, height, y_fractions = [0.5]) {

		// Avoid anti-aliasing... (FIXME: we assumed graph size was even)
		let pixel_y_adjustment = config.graph_line_width % 2 === 0 ? 0 : -0.5;

		graphctx.strokeStyle = "#666666";
		graphctx.lineWidth = config.graph_line_width;
		graphctx.setLineDash([config.graph_line_width, config.graph_line_width]);

		for (let y_fraction of y_fractions) {
			graphctx.beginPath();
			graphctx.moveTo(0, height * y_fraction + pixel_y_adjustment);
			graphctx.lineTo(width, height * y_fraction + pixel_y_adjustment);
			graphctx.stroke();
		}
	};

	grapher.draw_position_line = function(eval_list_length, node) {

		if (eval_list_length < 2) {
			return;
		}

		let width = graph.width;
		let height = graph.height;

		// Avoid anti-aliasing...
		let pixel_x_adjustment = config.graph_line_width % 2 === 0 ? 0 : 0.5;

		let x = Math.floor(width * node.depth / node.graph_length_knower.val) + pixel_x_adjustment;

		graphctx.strokeStyle = node.is_main_line() ? "#6cccee" : "#ffff00";
		graphctx.lineWidth = config.graph_line_width;
		graphctx.setLineDash([config.graph_line_width, config.graph_line_width]);

		graphctx.beginPath();
		graphctx.moveTo(x, 0);
		graphctx.lineTo(x, height);
		graphctx.stroke();

	};

	grapher.node_from_click = function(node, event) {

		if (!event || config.graph_height <= 0) {
			return null;
		}

		let mousex = event.offsetX;
		if (typeof mousex !== "number") {
			return null;
		}

		let width = graph.width;
		if (typeof width !== "number" || width < 1) {
			return null;
		}

		let node_list = node.future_node_history();
		if (node_list.length === 0) {
			return null;
		}

		// OK, everything is valid...

		let click_depth = Math.round(node.graph_length_knower.val * mousex / width);

		if (click_depth < 0) click_depth = 0;
		if (click_depth >= node_list.length) click_depth = node_list.length - 1;

		return node_list[click_depth];
	};

	return grapher;
}
