function noop() { }
function run(fn) {
    return fn();
}
function blank_object() {
    return Object.create(null);
}
function run_all(fns) {
    fns.forEach(run);
}
function is_function(thing) {
    return typeof thing === 'function';
}
function safe_not_equal(a, b) {
    return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
}
function is_empty(obj) {
    return Object.keys(obj).length === 0;
}

// Track which nodes are claimed during hydration. Unclaimed nodes can then be removed from the DOM
// at the end of hydration without touching the remaining nodes.
let is_hydrating = false;
function start_hydrating() {
    is_hydrating = true;
}
function end_hydrating() {
    is_hydrating = false;
}
function upper_bound(low, high, key, value) {
    // Return first index of value larger than input value in the range [low, high)
    while (low < high) {
        const mid = low + ((high - low) >> 1);
        if (key(mid) <= value) {
            low = mid + 1;
        }
        else {
            high = mid;
        }
    }
    return low;
}
function init_hydrate(target) {
    if (target.hydrate_init)
        return;
    target.hydrate_init = true;
    // We know that all children have claim_order values since the unclaimed have been detached if target is not <head>
    let children = target.childNodes;
    // If target is <head>, there may be children without claim_order
    if (target.nodeName === 'HEAD') {
        const myChildren = [];
        for (let i = 0; i < children.length; i++) {
            const node = children[i];
            if (node.claim_order !== undefined) {
                myChildren.push(node);
            }
        }
        children = myChildren;
    }
    /*
    * Reorder claimed children optimally.
    * We can reorder claimed children optimally by finding the longest subsequence of
    * nodes that are already claimed in order and only moving the rest. The longest
    * subsequence of nodes that are claimed in order can be found by
    * computing the longest increasing subsequence of .claim_order values.
    *
    * This algorithm is optimal in generating the least amount of reorder operations
    * possible.
    *
    * Proof:
    * We know that, given a set of reordering operations, the nodes that do not move
    * always form an increasing subsequence, since they do not move among each other
    * meaning that they must be already ordered among each other. Thus, the maximal
    * set of nodes that do not move form a longest increasing subsequence.
    */
    // Compute longest increasing subsequence
    // m: subsequence length j => index k of smallest value that ends an increasing subsequence of length j
    const m = new Int32Array(children.length + 1);
    // Predecessor indices + 1
    const p = new Int32Array(children.length);
    m[0] = -1;
    let longest = 0;
    for (let i = 0; i < children.length; i++) {
        const current = children[i].claim_order;
        // Find the largest subsequence length such that it ends in a value less than our current value
        // upper_bound returns first greater value, so we subtract one
        // with fast path for when we are on the current longest subsequence
        const seqLen = ((longest > 0 && children[m[longest]].claim_order <= current) ? longest + 1 : upper_bound(1, longest, idx => children[m[idx]].claim_order, current)) - 1;
        p[i] = m[seqLen] + 1;
        const newLen = seqLen + 1;
        // We can guarantee that current is the smallest value. Otherwise, we would have generated a longer sequence.
        m[newLen] = i;
        longest = Math.max(newLen, longest);
    }
    // The longest increasing subsequence of nodes (initially reversed)
    const lis = [];
    // The rest of the nodes, nodes that will be moved
    const toMove = [];
    let last = children.length - 1;
    for (let cur = m[longest] + 1; cur != 0; cur = p[cur - 1]) {
        lis.push(children[cur - 1]);
        for (; last >= cur; last--) {
            toMove.push(children[last]);
        }
        last--;
    }
    for (; last >= 0; last--) {
        toMove.push(children[last]);
    }
    lis.reverse();
    // We sort the nodes being moved to guarantee that their insertion order matches the claim order
    toMove.sort((a, b) => a.claim_order - b.claim_order);
    // Finally, we move the nodes
    for (let i = 0, j = 0; i < toMove.length; i++) {
        while (j < lis.length && toMove[i].claim_order >= lis[j].claim_order) {
            j++;
        }
        const anchor = j < lis.length ? lis[j] : null;
        target.insertBefore(toMove[i], anchor);
    }
}
function append(target, node) {
    target.appendChild(node);
}
function append_styles(target, style_sheet_id, styles) {
    const append_styles_to = get_root_for_style(target);
    if (!append_styles_to.getElementById(style_sheet_id)) {
        const style = element('style');
        style.id = style_sheet_id;
        style.textContent = styles;
        append_stylesheet(append_styles_to, style);
    }
}
function get_root_for_style(node) {
    if (!node)
        return document;
    const root = node.getRootNode ? node.getRootNode() : node.ownerDocument;
    if (root && root.host) {
        return root;
    }
    return node.ownerDocument;
}
function append_stylesheet(node, style) {
    append(node.head || node, style);
    return style.sheet;
}
function append_hydration(target, node) {
    if (is_hydrating) {
        init_hydrate(target);
        if ((target.actual_end_child === undefined) || ((target.actual_end_child !== null) && (target.actual_end_child.parentNode !== target))) {
            target.actual_end_child = target.firstChild;
        }
        // Skip nodes of undefined ordering
        while ((target.actual_end_child !== null) && (target.actual_end_child.claim_order === undefined)) {
            target.actual_end_child = target.actual_end_child.nextSibling;
        }
        if (node !== target.actual_end_child) {
            // We only insert if the ordering of this node should be modified or the parent node is not target
            if (node.claim_order !== undefined || node.parentNode !== target) {
                target.insertBefore(node, target.actual_end_child);
            }
        }
        else {
            target.actual_end_child = node.nextSibling;
        }
    }
    else if (node.parentNode !== target || node.nextSibling !== null) {
        target.appendChild(node);
    }
}
function insert_hydration(target, node, anchor) {
    if (is_hydrating && !anchor) {
        append_hydration(target, node);
    }
    else if (node.parentNode !== target || node.nextSibling != anchor) {
        target.insertBefore(node, anchor || null);
    }
}
function detach(node) {
    if (node.parentNode) {
        node.parentNode.removeChild(node);
    }
}
function element(name) {
    return document.createElement(name);
}
function text(data) {
    return document.createTextNode(data);
}
function space() {
    return text(' ');
}
function attr(node, attribute, value) {
    if (value == null)
        node.removeAttribute(attribute);
    else if (node.getAttribute(attribute) !== value)
        node.setAttribute(attribute, value);
}
function children(element) {
    return Array.from(element.childNodes);
}
function init_claim_info(nodes) {
    if (nodes.claim_info === undefined) {
        nodes.claim_info = { last_index: 0, total_claimed: 0 };
    }
}
function claim_node(nodes, predicate, processNode, createNode, dontUpdateLastIndex = false) {
    // Try to find nodes in an order such that we lengthen the longest increasing subsequence
    init_claim_info(nodes);
    const resultNode = (() => {
        // We first try to find an element after the previous one
        for (let i = nodes.claim_info.last_index; i < nodes.length; i++) {
            const node = nodes[i];
            if (predicate(node)) {
                const replacement = processNode(node);
                if (replacement === undefined) {
                    nodes.splice(i, 1);
                }
                else {
                    nodes[i] = replacement;
                }
                if (!dontUpdateLastIndex) {
                    nodes.claim_info.last_index = i;
                }
                return node;
            }
        }
        // Otherwise, we try to find one before
        // We iterate in reverse so that we don't go too far back
        for (let i = nodes.claim_info.last_index - 1; i >= 0; i--) {
            const node = nodes[i];
            if (predicate(node)) {
                const replacement = processNode(node);
                if (replacement === undefined) {
                    nodes.splice(i, 1);
                }
                else {
                    nodes[i] = replacement;
                }
                if (!dontUpdateLastIndex) {
                    nodes.claim_info.last_index = i;
                }
                else if (replacement === undefined) {
                    // Since we spliced before the last_index, we decrease it
                    nodes.claim_info.last_index--;
                }
                return node;
            }
        }
        // If we can't find any matching node, we create a new one
        return createNode();
    })();
    resultNode.claim_order = nodes.claim_info.total_claimed;
    nodes.claim_info.total_claimed += 1;
    return resultNode;
}
function claim_element_base(nodes, name, attributes, create_element) {
    return claim_node(nodes, (node) => node.nodeName === name, (node) => {
        const remove = [];
        for (let j = 0; j < node.attributes.length; j++) {
            const attribute = node.attributes[j];
            if (!attributes[attribute.name]) {
                remove.push(attribute.name);
            }
        }
        remove.forEach(v => node.removeAttribute(v));
        return undefined;
    }, () => create_element(name));
}
function claim_element(nodes, name, attributes) {
    return claim_element_base(nodes, name, attributes, element);
}
function claim_text(nodes, data) {
    return claim_node(nodes, (node) => node.nodeType === 3, (node) => {
        const dataStr = '' + data;
        if (node.data.startsWith(dataStr)) {
            if (node.data.length !== dataStr.length) {
                return node.splitText(dataStr.length);
            }
        }
        else {
            node.data = dataStr;
        }
    }, () => text(data), true // Text nodes should not update last index since it is likely not worth it to eliminate an increasing subsequence of actual elements
    );
}
function claim_space(nodes) {
    return claim_text(nodes, ' ');
}
function set_data(text, data) {
    data = '' + data;
    if (text.data === data)
        return;
    text.data = data;
}

let current_component;
function set_current_component(component) {
    current_component = component;
}

const dirty_components = [];
const binding_callbacks = [];
let render_callbacks = [];
const flush_callbacks = [];
const resolved_promise = /* @__PURE__ */ Promise.resolve();
let update_scheduled = false;
function schedule_update() {
    if (!update_scheduled) {
        update_scheduled = true;
        resolved_promise.then(flush);
    }
}
function add_render_callback(fn) {
    render_callbacks.push(fn);
}
// flush() calls callbacks in this order:
// 1. All beforeUpdate callbacks, in order: parents before children
// 2. All bind:this callbacks, in reverse order: children before parents.
// 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
//    for afterUpdates called during the initial onMount, which are called in
//    reverse order: children before parents.
// Since callbacks might update component values, which could trigger another
// call to flush(), the following steps guard against this:
// 1. During beforeUpdate, any updated components will be added to the
//    dirty_components array and will cause a reentrant call to flush(). Because
//    the flush index is kept outside the function, the reentrant call will pick
//    up where the earlier call left off and go through all dirty components. The
//    current_component value is saved and restored so that the reentrant call will
//    not interfere with the "parent" flush() call.
// 2. bind:this callbacks cannot trigger new flush() calls.
// 3. During afterUpdate, any updated components will NOT have their afterUpdate
//    callback called a second time; the seen_callbacks set, outside the flush()
//    function, guarantees this behavior.
const seen_callbacks = new Set();
let flushidx = 0; // Do *not* move this inside the flush() function
function flush() {
    // Do not reenter flush while dirty components are updated, as this can
    // result in an infinite loop. Instead, let the inner flush handle it.
    // Reentrancy is ok afterwards for bindings etc.
    if (flushidx !== 0) {
        return;
    }
    const saved_component = current_component;
    do {
        // first, call beforeUpdate functions
        // and update components
        try {
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
        }
        catch (e) {
            // reset dirty state to not end up in a deadlocked state and then rethrow
            dirty_components.length = 0;
            flushidx = 0;
            throw e;
        }
        set_current_component(null);
        dirty_components.length = 0;
        flushidx = 0;
        while (binding_callbacks.length)
            binding_callbacks.pop()();
        // then, once components are updated, call
        // afterUpdate functions. This may cause
        // subsequent updates...
        for (let i = 0; i < render_callbacks.length; i += 1) {
            const callback = render_callbacks[i];
            if (!seen_callbacks.has(callback)) {
                // ...so guard against infinite loops
                seen_callbacks.add(callback);
                callback();
            }
        }
        render_callbacks.length = 0;
    } while (dirty_components.length);
    while (flush_callbacks.length) {
        flush_callbacks.pop()();
    }
    update_scheduled = false;
    seen_callbacks.clear();
    set_current_component(saved_component);
}
function update($$) {
    if ($$.fragment !== null) {
        $$.update();
        run_all($$.before_update);
        const dirty = $$.dirty;
        $$.dirty = [-1];
        $$.fragment && $$.fragment.p($$.ctx, dirty);
        $$.after_update.forEach(add_render_callback);
    }
}
/**
 * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
 */
function flush_render_callbacks(fns) {
    const filtered = [];
    const targets = [];
    render_callbacks.forEach((c) => fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c));
    targets.forEach((c) => c());
    render_callbacks = filtered;
}
const outroing = new Set();
function transition_in(block, local) {
    if (block && block.i) {
        outroing.delete(block);
        block.i(local);
    }
}

function destroy_block(block, lookup) {
    block.d(1);
    lookup.delete(block.key);
}
function update_keyed_each(old_blocks, dirty, get_key, dynamic, ctx, list, lookup, node, destroy, create_each_block, next, get_context) {
    let o = old_blocks.length;
    let n = list.length;
    let i = o;
    const old_indexes = {};
    while (i--)
        old_indexes[old_blocks[i].key] = i;
    const new_blocks = [];
    const new_lookup = new Map();
    const deltas = new Map();
    const updates = [];
    i = n;
    while (i--) {
        const child_ctx = get_context(ctx, list, i);
        const key = get_key(child_ctx);
        let block = lookup.get(key);
        if (!block) {
            block = create_each_block(key, child_ctx);
            block.c();
        }
        else if (dynamic) {
            // defer updates until all the DOM shuffling is done
            updates.push(() => block.p(child_ctx, dirty));
        }
        new_lookup.set(key, new_blocks[i] = block);
        if (key in old_indexes)
            deltas.set(key, Math.abs(i - old_indexes[key]));
    }
    const will_move = new Set();
    const did_move = new Set();
    function insert(block) {
        transition_in(block, 1);
        block.m(node, next);
        lookup.set(block.key, block);
        next = block.first;
        n--;
    }
    while (o && n) {
        const new_block = new_blocks[n - 1];
        const old_block = old_blocks[o - 1];
        const new_key = new_block.key;
        const old_key = old_block.key;
        if (new_block === old_block) {
            // do nothing
            next = new_block.first;
            o--;
            n--;
        }
        else if (!new_lookup.has(old_key)) {
            // remove old block
            destroy(old_block, lookup);
            o--;
        }
        else if (!lookup.has(new_key) || will_move.has(new_key)) {
            insert(new_block);
        }
        else if (did_move.has(old_key)) {
            o--;
        }
        else if (deltas.get(new_key) > deltas.get(old_key)) {
            did_move.add(new_key);
            insert(new_block);
        }
        else {
            will_move.add(old_key);
            o--;
        }
    }
    while (o--) {
        const old_block = old_blocks[o];
        if (!new_lookup.has(old_block.key))
            destroy(old_block, lookup);
    }
    while (n)
        insert(new_blocks[n - 1]);
    run_all(updates);
    return new_blocks;
}
function mount_component(component, target, anchor, customElement) {
    const { fragment, after_update } = component.$$;
    fragment && fragment.m(target, anchor);
    if (!customElement) {
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
            // if the component was destroyed immediately
            // it will update the `$$.on_destroy` reference to `null`.
            // the destructured on_destroy may still reference to the old array
            if (component.$$.on_destroy) {
                component.$$.on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
    }
    after_update.forEach(add_render_callback);
}
function destroy_component(component, detaching) {
    const $$ = component.$$;
    if ($$.fragment !== null) {
        flush_render_callbacks($$.after_update);
        run_all($$.on_destroy);
        $$.fragment && $$.fragment.d(detaching);
        // TODO null out other refs, including component.$$ (but need to
        // preserve final state?)
        $$.on_destroy = $$.fragment = null;
        $$.ctx = [];
    }
}
function make_dirty(component, i) {
    if (component.$$.dirty[0] === -1) {
        dirty_components.push(component);
        schedule_update();
        component.$$.dirty.fill(0);
    }
    component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
}
function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
    const parent_component = current_component;
    set_current_component(component);
    const $$ = component.$$ = {
        fragment: null,
        ctx: [],
        // state
        props,
        update: noop,
        not_equal,
        bound: blank_object(),
        // lifecycle
        on_mount: [],
        on_destroy: [],
        on_disconnect: [],
        before_update: [],
        after_update: [],
        context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
        // everything else
        callbacks: blank_object(),
        dirty,
        skip_bound: false,
        root: options.target || parent_component.$$.root
    };
    append_styles && append_styles($$.root);
    let ready = false;
    $$.ctx = instance
        ? instance(component, options.props || {}, (i, ret, ...rest) => {
            const value = rest.length ? rest[0] : ret;
            if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                if (!$$.skip_bound && $$.bound[i])
                    $$.bound[i](value);
                if (ready)
                    make_dirty(component, i);
            }
            return ret;
        })
        : [];
    $$.update();
    ready = true;
    run_all($$.before_update);
    // `false` as a special case of no DOM component
    $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
    if (options.target) {
        if (options.hydrate) {
            start_hydrating();
            const nodes = children(options.target);
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            $$.fragment && $$.fragment.l(nodes);
            nodes.forEach(detach);
        }
        else {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            $$.fragment && $$.fragment.c();
        }
        if (options.intro)
            transition_in(component.$$.fragment);
        mount_component(component, options.target, options.anchor, options.customElement);
        end_hydrating();
        flush();
    }
    set_current_component(parent_component);
}
/**
 * Base class for Svelte components. Used when dev=false.
 */
class SvelteComponent {
    $destroy() {
        destroy_component(this, 1);
        this.$destroy = noop;
    }
    $on(type, callback) {
        if (!is_function(callback)) {
            return noop;
        }
        const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
        callbacks.push(callback);
        return () => {
            const index = callbacks.indexOf(callback);
            if (index !== -1)
                callbacks.splice(index, 1);
        };
    }
    $set($$props) {
        if (this.$$set && !is_empty($$props)) {
            this.$$.skip_bound = true;
            this.$$set($$props);
            this.$$.skip_bound = false;
        }
    }
}

/* src/InstanceView.svelte generated by Svelte v3.59.2 */

function add_css(target) {
	append_styles(target, "svelte-1gn92d6", "#container.svelte-1gn92d6.svelte-1gn92d6{display:flex;flex-direction:column;border:1px solid rgb(224, 224, 224);min-width:350px;border-radius:2px;padding:10px;margin:2.5px}#example_table.svelte-1gn92d6.svelte-1gn92d6{font-family:Arial, Helvetica, sans-serif;border-collapse:collapse;width:100%}#example_table.svelte-1gn92d6 td.svelte-1gn92d6,#example_table.svelte-1gn92d6 th.svelte-1gn92d6{border:1px solid #ddd;padding:8px}#example_table.svelte-1gn92d6 tr.label.svelte-1gn92d6{background-color:#f2f2f2}");
}

function get_each_context(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[0] = list[i];
	return child_ctx;
}

function get_each_context_1(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[11] = list[i];
	return child_ctx;
}

function get_each_context_2(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[0] = list[i];
	return child_ctx;
}

function get_each_context_3(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[11] = list[i];
	return child_ctx;
}

function get_each_context_4(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[0] = list[i];
	return child_ctx;
}

function get_each_context_5(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[11] = list[i];
	return child_ctx;
}

// (27:10) {#each entry as cell (cell)}
function create_each_block_5(key_1, ctx) {
	let td;
	let t_value = /*cell*/ ctx[11] + "";
	let t;

	return {
		key: key_1,
		first: null,
		c() {
			td = element("td");
			t = text(t_value);
			this.h();
		},
		l(nodes) {
			td = claim_element(nodes, "TD", { class: true });
			var td_nodes = children(td);
			t = claim_text(td_nodes, t_value);
			td_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(td, "class", "svelte-1gn92d6");
			this.first = td;
		},
		m(target, anchor) {
			insert_hydration(target, td, anchor);
			append_hydration(td, t);
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;
			if (dirty & /*dataEntries*/ 8 && t_value !== (t_value = /*cell*/ ctx[11] + "")) set_data(t, t_value);
		},
		d(detaching) {
			if (detaching) detach(td);
		}
	};
}

// (24:6) {#each dataEntries as entry (entry)}
function create_each_block_4(key_1, ctx) {
	let tr;
	let th;
	let t0;
	let t1;
	let each_blocks = [];
	let each_1_lookup = new Map();
	let each_value_5 = /*entry*/ ctx[0];
	const get_key = ctx => /*cell*/ ctx[11];

	for (let i = 0; i < each_value_5.length; i += 1) {
		let child_ctx = get_each_context_5(ctx, each_value_5, i);
		let key = get_key(child_ctx);
		each_1_lookup.set(key, each_blocks[i] = create_each_block_5(key, child_ctx));
	}

	return {
		key: key_1,
		first: null,
		c() {
			tr = element("tr");
			th = element("th");
			t0 = text("Data:");
			t1 = space();

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			this.h();
		},
		l(nodes) {
			tr = claim_element(nodes, "TR", {});
			var tr_nodes = children(tr);
			th = claim_element(tr_nodes, "TH", { class: true });
			var th_nodes = children(th);
			t0 = claim_text(th_nodes, "Data:");
			th_nodes.forEach(detach);
			t1 = claim_space(tr_nodes);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].l(tr_nodes);
			}

			tr_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(th, "class", "svelte-1gn92d6");
			this.first = tr;
		},
		m(target, anchor) {
			insert_hydration(target, tr, anchor);
			append_hydration(tr, th);
			append_hydration(th, t0);
			append_hydration(tr, t1);

			for (let i = 0; i < each_blocks.length; i += 1) {
				if (each_blocks[i]) {
					each_blocks[i].m(tr, null);
				}
			}
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;

			if (dirty & /*dataEntries*/ 8) {
				each_value_5 = /*entry*/ ctx[0];
				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value_5, each_1_lookup, tr, destroy_block, create_each_block_5, null, get_each_context_5);
			}
		},
		d(detaching) {
			if (detaching) detach(tr);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].d();
			}
		}
	};
}

// (35:10) {#each entry as cell (cell)}
function create_each_block_3(key_1, ctx) {
	let td;
	let t_value = /*cell*/ ctx[11] + "";
	let t;

	return {
		key: key_1,
		first: null,
		c() {
			td = element("td");
			t = text(t_value);
			this.h();
		},
		l(nodes) {
			td = claim_element(nodes, "TD", { class: true });
			var td_nodes = children(td);
			t = claim_text(td_nodes, t_value);
			td_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(td, "class", "svelte-1gn92d6");
			this.first = td;
		},
		m(target, anchor) {
			insert_hydration(target, td, anchor);
			append_hydration(td, t);
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;
			if (dirty & /*labelEntries*/ 4 && t_value !== (t_value = /*cell*/ ctx[11] + "")) set_data(t, t_value);
		},
		d(detaching) {
			if (detaching) detach(td);
		}
	};
}

// (32:6) {#each labelEntries as entry (entry)}
function create_each_block_2(key_1, ctx) {
	let tr;
	let th;
	let t0;
	let t1;
	let each_blocks = [];
	let each_1_lookup = new Map();
	let each_value_3 = /*entry*/ ctx[0];
	const get_key = ctx => /*cell*/ ctx[11];

	for (let i = 0; i < each_value_3.length; i += 1) {
		let child_ctx = get_each_context_3(ctx, each_value_3, i);
		let key = get_key(child_ctx);
		each_1_lookup.set(key, each_blocks[i] = create_each_block_3(key, child_ctx));
	}

	return {
		key: key_1,
		first: null,
		c() {
			tr = element("tr");
			th = element("th");
			t0 = text("Label:");
			t1 = space();

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			this.h();
		},
		l(nodes) {
			tr = claim_element(nodes, "TR", { class: true });
			var tr_nodes = children(tr);
			th = claim_element(tr_nodes, "TH", { class: true });
			var th_nodes = children(th);
			t0 = claim_text(th_nodes, "Label:");
			th_nodes.forEach(detach);
			t1 = claim_space(tr_nodes);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].l(tr_nodes);
			}

			tr_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(th, "class", "svelte-1gn92d6");
			attr(tr, "class", "label svelte-1gn92d6");
			this.first = tr;
		},
		m(target, anchor) {
			insert_hydration(target, tr, anchor);
			append_hydration(tr, th);
			append_hydration(th, t0);
			append_hydration(tr, t1);

			for (let i = 0; i < each_blocks.length; i += 1) {
				if (each_blocks[i]) {
					each_blocks[i].m(tr, null);
				}
			}
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;

			if (dirty & /*labelEntries*/ 4) {
				each_value_3 = /*entry*/ ctx[0];
				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value_3, each_1_lookup, tr, destroy_block, create_each_block_3, null, get_each_context_3);
			}
		},
		d(detaching) {
			if (detaching) detach(tr);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].d();
			}
		}
	};
}

// (43:10) {#each entry as cell (cell)}
function create_each_block_1(key_1, ctx) {
	let td;
	let t_value = /*cell*/ ctx[11] + "";
	let t;

	return {
		key: key_1,
		first: null,
		c() {
			td = element("td");
			t = text(t_value);
			this.h();
		},
		l(nodes) {
			td = claim_element(nodes, "TD", { class: true });
			var td_nodes = children(td);
			t = claim_text(td_nodes, t_value);
			td_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(td, "class", "svelte-1gn92d6");
			this.first = td;
		},
		m(target, anchor) {
			insert_hydration(target, td, anchor);
			append_hydration(td, t);
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;
			if (dirty & /*modelEntries*/ 2 && t_value !== (t_value = /*cell*/ ctx[11] + "")) set_data(t, t_value);
		},
		d(detaching) {
			if (detaching) detach(td);
		}
	};
}

// (40:6) {#each modelEntries as entry (entry)}
function create_each_block(key_1, ctx) {
	let tr;
	let th;
	let t0;
	let t1;
	let each_blocks = [];
	let each_1_lookup = new Map();
	let t2;
	let each_value_1 = /*entry*/ ctx[0];
	const get_key = ctx => /*cell*/ ctx[11];

	for (let i = 0; i < each_value_1.length; i += 1) {
		let child_ctx = get_each_context_1(ctx, each_value_1, i);
		let key = get_key(child_ctx);
		each_1_lookup.set(key, each_blocks[i] = create_each_block_1(key, child_ctx));
	}

	return {
		key: key_1,
		first: null,
		c() {
			tr = element("tr");
			th = element("th");
			t0 = text("Model:");
			t1 = space();

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			t2 = space();
			this.h();
		},
		l(nodes) {
			tr = claim_element(nodes, "TR", {});
			var tr_nodes = children(tr);
			th = claim_element(tr_nodes, "TH", { class: true });
			var th_nodes = children(th);
			t0 = claim_text(th_nodes, "Model:");
			th_nodes.forEach(detach);
			t1 = claim_space(tr_nodes);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].l(tr_nodes);
			}

			t2 = claim_space(tr_nodes);
			tr_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(th, "class", "svelte-1gn92d6");
			this.first = tr;
		},
		m(target, anchor) {
			insert_hydration(target, tr, anchor);
			append_hydration(tr, th);
			append_hydration(th, t0);
			append_hydration(tr, t1);

			for (let i = 0; i < each_blocks.length; i += 1) {
				if (each_blocks[i]) {
					each_blocks[i].m(tr, null);
				}
			}

			append_hydration(tr, t2);
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;

			if (dirty & /*modelEntries*/ 2) {
				each_value_1 = /*entry*/ ctx[0];
				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value_1, each_1_lookup, tr, destroy_block, create_each_block_1, t2, get_each_context_1);
			}
		},
		d(detaching) {
			if (detaching) detach(tr);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].d();
			}
		}
	};
}

function create_fragment(ctx) {
	let div;
	let table;
	let tbody;
	let each_blocks_2 = [];
	let each0_lookup = new Map();
	let t0;
	let each_blocks_1 = [];
	let each1_lookup = new Map();
	let t1;
	let each_blocks = [];
	let each2_lookup = new Map();
	let each_value_4 = /*dataEntries*/ ctx[3];
	const get_key = ctx => /*entry*/ ctx[0];

	for (let i = 0; i < each_value_4.length; i += 1) {
		let child_ctx = get_each_context_4(ctx, each_value_4, i);
		let key = get_key(child_ctx);
		each0_lookup.set(key, each_blocks_2[i] = create_each_block_4(key, child_ctx));
	}

	let each_value_2 = /*labelEntries*/ ctx[2];
	const get_key_1 = ctx => /*entry*/ ctx[0];

	for (let i = 0; i < each_value_2.length; i += 1) {
		let child_ctx = get_each_context_2(ctx, each_value_2, i);
		let key = get_key_1(child_ctx);
		each1_lookup.set(key, each_blocks_1[i] = create_each_block_2(key, child_ctx));
	}

	let each_value = /*modelEntries*/ ctx[1];
	const get_key_2 = ctx => /*entry*/ ctx[0];

	for (let i = 0; i < each_value.length; i += 1) {
		let child_ctx = get_each_context(ctx, each_value, i);
		let key = get_key_2(child_ctx);
		each2_lookup.set(key, each_blocks[i] = create_each_block(key, child_ctx));
	}

	return {
		c() {
			div = element("div");
			table = element("table");
			tbody = element("tbody");

			for (let i = 0; i < each_blocks_2.length; i += 1) {
				each_blocks_2[i].c();
			}

			t0 = space();

			for (let i = 0; i < each_blocks_1.length; i += 1) {
				each_blocks_1[i].c();
			}

			t1 = space();

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			this.h();
		},
		l(nodes) {
			div = claim_element(nodes, "DIV", { id: true, class: true });
			var div_nodes = children(div);
			table = claim_element(div_nodes, "TABLE", { id: true, class: true });
			var table_nodes = children(table);
			tbody = claim_element(table_nodes, "TBODY", {});
			var tbody_nodes = children(tbody);

			for (let i = 0; i < each_blocks_2.length; i += 1) {
				each_blocks_2[i].l(tbody_nodes);
			}

			t0 = claim_space(tbody_nodes);

			for (let i = 0; i < each_blocks_1.length; i += 1) {
				each_blocks_1[i].l(tbody_nodes);
			}

			t1 = claim_space(tbody_nodes);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].l(tbody_nodes);
			}

			tbody_nodes.forEach(detach);
			table_nodes.forEach(detach);
			div_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(table, "id", "example_table");
			attr(table, "class", "svelte-1gn92d6");
			attr(div, "id", "container");
			attr(div, "class", "svelte-1gn92d6");
		},
		m(target, anchor) {
			insert_hydration(target, div, anchor);
			append_hydration(div, table);
			append_hydration(table, tbody);

			for (let i = 0; i < each_blocks_2.length; i += 1) {
				if (each_blocks_2[i]) {
					each_blocks_2[i].m(tbody, null);
				}
			}

			append_hydration(tbody, t0);

			for (let i = 0; i < each_blocks_1.length; i += 1) {
				if (each_blocks_1[i]) {
					each_blocks_1[i].m(tbody, null);
				}
			}

			append_hydration(tbody, t1);

			for (let i = 0; i < each_blocks.length; i += 1) {
				if (each_blocks[i]) {
					each_blocks[i].m(tbody, null);
				}
			}
		},
		p(ctx, [dirty]) {
			if (dirty & /*dataEntries*/ 8) {
				each_value_4 = /*dataEntries*/ ctx[3];
				each_blocks_2 = update_keyed_each(each_blocks_2, dirty, get_key, 1, ctx, each_value_4, each0_lookup, tbody, destroy_block, create_each_block_4, t0, get_each_context_4);
			}

			if (dirty & /*labelEntries*/ 4) {
				each_value_2 = /*labelEntries*/ ctx[2];
				each_blocks_1 = update_keyed_each(each_blocks_1, dirty, get_key_1, 1, ctx, each_value_2, each1_lookup, tbody, destroy_block, create_each_block_2, t1, get_each_context_2);
			}

			if (dirty & /*modelEntries*/ 2) {
				each_value = /*modelEntries*/ ctx[1];
				each_blocks = update_keyed_each(each_blocks, dirty, get_key_2, 1, ctx, each_value, each2_lookup, tbody, destroy_block, create_each_block, null, get_each_context);
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(div);

			for (let i = 0; i < each_blocks_2.length; i += 1) {
				each_blocks_2[i].d();
			}

			for (let i = 0; i < each_blocks_1.length; i += 1) {
				each_blocks_1[i].d();
			}

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].d();
			}
		}
	};
}

function instance($$self, $$props, $$invalidate) {
	let dataEntries;
	let labelEntries;
	let modelEntries;
	let { options } = $$props;
	let { entry } = $$props;
	let { modelColumn } = $$props;
	let { labelColumn } = $$props;
	let { dataColumn } = $$props;
	let { idColumn } = $$props;

	$$self.$$set = $$props => {
		if ('options' in $$props) $$invalidate(4, options = $$props.options);
		if ('entry' in $$props) $$invalidate(0, entry = $$props.entry);
		if ('modelColumn' in $$props) $$invalidate(5, modelColumn = $$props.modelColumn);
		if ('labelColumn' in $$props) $$invalidate(6, labelColumn = $$props.labelColumn);
		if ('dataColumn' in $$props) $$invalidate(7, dataColumn = $$props.dataColumn);
		if ('idColumn' in $$props) $$invalidate(8, idColumn = $$props.idColumn);
	};

	$$self.$$.update = () => {
		if ($$self.$$.dirty & /*entry, dataColumn*/ 129) {
			// Split each column by newlines then spaces.
			$$invalidate(3, dataEntries = entry[dataColumn].split("\n").map(x => x.split(" ")));
		}

		if ($$self.$$.dirty & /*entry, labelColumn*/ 65) {
			$$invalidate(2, labelEntries = entry[labelColumn].split("\n").map(x => x.split(" ")));
		}

		if ($$self.$$.dirty & /*entry, modelColumn*/ 33) {
			$$invalidate(1, modelEntries = entry[modelColumn].split("\n").map(x => x.split(" ")));
		}
	};

	return [
		entry,
		modelEntries,
		labelEntries,
		dataEntries,
		options,
		modelColumn,
		labelColumn,
		dataColumn,
		idColumn
	];
}

class InstanceView extends SvelteComponent {
	constructor(options) {
		super();

		init(
			this,
			options,
			instance,
			create_fragment,
			safe_not_equal,
			{
				options: 4,
				entry: 0,
				modelColumn: 5,
				labelColumn: 6,
				dataColumn: 7,
				idColumn: 8
			},
			add_css
		);
	}
}

function getInstance(
  div,
  viewOptions,
  entry,
  modelColumn,
  labelColumn,
  dataColumn,
  idColumn
) {
  new InstanceView({
    target: div,
    props: {
      entry: entry,
      viewOptions: viewOptions,
      modelColumn: modelColumn,
      labelColumn: labelColumn,
      dataColumn: dataColumn,
      idColumn: idColumn,
    },
    hydrate: true,
  });
}

// export function getOptions(div, setOptions) {
//   new OptionsView({
//     target: div,
//     props: {
//       setOptions,
//     },
//   });
// }

export { getInstance };
