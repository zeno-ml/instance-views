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
function null_to_empty(value) {
    return value == null ? '' : value;
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
function destroy_each(iterations, detaching) {
    for (let i = 0; i < iterations.length; i += 1) {
        if (iterations[i])
            iterations[i].d(detaching);
    }
}
function element(name) {
    return document.createElement(name);
}
function svg_element(name) {
    return document.createElementNS('http://www.w3.org/2000/svg', name);
}
function text(data) {
    return document.createTextNode(data);
}
function space() {
    return text(' ');
}
function empty() {
    return text('');
}
function listen(node, event, handler, options) {
    node.addEventListener(event, handler, options);
    return () => node.removeEventListener(event, handler, options);
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
function claim_svg_element(nodes, name, attributes) {
    return claim_element_base(nodes, name, attributes, svg_element);
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
function toggle_class(element, name, toggle) {
    element.classList[toggle ? 'add' : 'remove'](name);
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
let outros;
function group_outros() {
    outros = {
        r: 0,
        c: [],
        p: outros // parent group
    };
}
function check_outros() {
    if (!outros.r) {
        run_all(outros.c);
    }
    outros = outros.p;
}
function transition_in(block, local) {
    if (block && block.i) {
        outroing.delete(block);
        block.i(local);
    }
}
function transition_out(block, local, detach, callback) {
    if (block && block.o) {
        if (outroing.has(block))
            return;
        outroing.add(block);
        outros.c.push(() => {
            outroing.delete(block);
            if (callback) {
                if (detach)
                    block.d(1);
                callback();
            }
        });
        block.o(local);
    }
    else if (callback) {
        callback();
    }
}
function create_component(block) {
    block && block.c();
}
function claim_component(block, parent_nodes) {
    block && block.l(parent_nodes);
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

/* src/AssistantBlock.svelte generated by Svelte v3.59.2 */

function add_css$3(target) {
	append_styles(target, "svelte-1fkw2wu", ".model.svelte-1fkw2wu.svelte-1fkw2wu{fill:var(--logo)}.no-model.svelte-1fkw2wu.svelte-1fkw2wu{fill:var(--G3)}.model-border.svelte-1fkw2wu.svelte-1fkw2wu{border:1px solid var(--logo)}.no-model-border.svelte-1fkw2wu.svelte-1fkw2wu{border:1px solid rgba(224, 224, 224, 1)}.box.svelte-1fkw2wu.svelte-1fkw2wu{margin-top:5px;margin-bottom:5px;display:flex;align-items:end;position:relative;z-index:1}.box.svelte-1fkw2wu svg.svelte-1fkw2wu{min-width:20px;width:20px;margin-right:10px;margin-top:7px}.chat.svelte-1fkw2wu.svelte-1fkw2wu{border-radius:5px;margin:0px;padding:10px;overflow-wrap:anywhere;max-width:70%}.message.svelte-1fkw2wu.svelte-1fkw2wu{position:relative;word-wrap:break-word;align-self:flex-start;background-color:white}.message.svelte-1fkw2wu.svelte-1fkw2wu::before{width:20px;left:-7px;background-color:rgba(224, 224, 224, 1);border-bottom-right-radius:16px 14px;position:absolute;bottom:0;height:25px;content:\"\";z-index:-1}.message.svelte-1fkw2wu.svelte-1fkw2wu::after{width:10px;background-color:white;left:-11px;border-bottom-right-radius:10px;position:absolute;bottom:0;height:25px;content:\"\";z-index:-1}.model-border.svelte-1fkw2wu.svelte-1fkw2wu::before{background-color:var(--logo)}");
}

function create_fragment$3(ctx) {
	let div;
	let svg;
	let path;
	let svg_class_value;
	let t0;
	let p;
	let t1;
	let p_class_value;

	return {
		c() {
			div = element("div");
			svg = svg_element("svg");
			path = svg_element("path");
			t0 = space();
			p = element("p");
			t1 = text(/*input*/ ctx[0]);
			this.h();
		},
		l(nodes) {
			div = claim_element(nodes, "DIV", { class: true });
			var div_nodes = children(div);
			svg = claim_svg_element(div_nodes, "svg", { xmlns: true, viewBox: true, class: true });
			var svg_nodes = children(svg);
			path = claim_svg_element(svg_nodes, "path", { d: true });
			children(path).forEach(detach);
			svg_nodes.forEach(detach);
			t0 = claim_space(div_nodes);
			p = claim_element(div_nodes, "P", { class: true });
			var p_nodes = children(p);
			t1 = claim_text(p_nodes, /*input*/ ctx[0]);
			p_nodes.forEach(detach);
			div_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(path, "d", "M320 0c17.7 0 32 14.3 32 32V96H472c39.8 0 72 32.2 72 72V440c0 39.8-32.2 72-72 72H168c-39.8 0-72-32.2-72-72V168c0-39.8 32.2-72 72-72H288V32c0-17.7 14.3-32 32-32zM208 384c-8.8 0-16 7.2-16 16s7.2 16 16 16h32c8.8 0 16-7.2 16-16s-7.2-16-16-16H208zm96 0c-8.8 0-16 7.2-16 16s7.2 16 16 16h32c8.8 0 16-7.2 16-16s-7.2-16-16-16H304zm96 0c-8.8 0-16 7.2-16 16s7.2 16 16 16h32c8.8 0 16-7.2 16-16s-7.2-16-16-16H400zM264 256a40 40 0 1 0 -80 0 40 40 0 1 0 80 0zm152 40a40 40 0 1 0 0-80 40 40 0 1 0 0 80zM48 224H64V416H48c-26.5 0-48-21.5-48-48V272c0-26.5 21.5-48 48-48zm544 0c26.5 0 48 21.5 48 48v96c0 26.5-21.5 48-48 48H576V224h16z");
			attr(svg, "xmlns", "http://www.w3.org/2000/svg");
			attr(svg, "viewBox", "0 0 640 512");
			attr(svg, "class", svg_class_value = "" + (null_to_empty(/*output*/ ctx[1] ? "model" : "no-model") + " svelte-1fkw2wu"));
			attr(p, "class", p_class_value = "chat message " + (/*output*/ ctx[1] ? 'model-border' : 'no-model-border') + " svelte-1fkw2wu");
			attr(div, "class", "box svelte-1fkw2wu");
		},
		m(target, anchor) {
			insert_hydration(target, div, anchor);
			append_hydration(div, svg);
			append_hydration(svg, path);
			append_hydration(div, t0);
			append_hydration(div, p);
			append_hydration(p, t1);
		},
		p(ctx, [dirty]) {
			if (dirty & /*output*/ 2 && svg_class_value !== (svg_class_value = "" + (null_to_empty(/*output*/ ctx[1] ? "model" : "no-model") + " svelte-1fkw2wu"))) {
				attr(svg, "class", svg_class_value);
			}

			if (dirty & /*input*/ 1) set_data(t1, /*input*/ ctx[0]);

			if (dirty & /*output*/ 2 && p_class_value !== (p_class_value = "chat message " + (/*output*/ ctx[1] ? 'model-border' : 'no-model-border') + " svelte-1fkw2wu")) {
				attr(p, "class", p_class_value);
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(div);
		}
	};
}

function instance$3($$self, $$props, $$invalidate) {
	let { input } = $$props;
	let { output = false } = $$props;

	$$self.$$set = $$props => {
		if ('input' in $$props) $$invalidate(0, input = $$props.input);
		if ('output' in $$props) $$invalidate(1, output = $$props.output);
	};

	return [input, output];
}

class AssistantBlock extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$3, create_fragment$3, safe_not_equal, { input: 0, output: 1 }, add_css$3);
	}
}

/* src/SystemBlock.svelte generated by Svelte v3.59.2 */

function add_css$2(target) {
	append_styles(target, "svelte-18o0ab2", "p.svelte-18o0ab2{margin:0px}");
}

function create_fragment$2(ctx) {
	let p;
	let b;
	let t0;
	let t1;
	let span;
	let t2;

	return {
		c() {
			p = element("p");
			b = element("b");
			t0 = text("System:");
			t1 = space();
			span = element("span");
			t2 = text(/*input*/ ctx[0]);
			this.h();
		},
		l(nodes) {
			p = claim_element(nodes, "P", { class: true });
			var p_nodes = children(p);
			b = claim_element(p_nodes, "B", {});
			var b_nodes = children(b);
			t0 = claim_text(b_nodes, "System:");
			b_nodes.forEach(detach);
			t1 = claim_space(p_nodes);
			span = claim_element(p_nodes, "SPAN", {});
			var span_nodes = children(span);
			t2 = claim_text(span_nodes, /*input*/ ctx[0]);
			span_nodes.forEach(detach);
			p_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(p, "class", "svelte-18o0ab2");
		},
		m(target, anchor) {
			insert_hydration(target, p, anchor);
			append_hydration(p, b);
			append_hydration(b, t0);
			append_hydration(p, t1);
			append_hydration(p, span);
			append_hydration(span, t2);
		},
		p(ctx, [dirty]) {
			if (dirty & /*input*/ 1) set_data(t2, /*input*/ ctx[0]);
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(p);
		}
	};
}

function instance$2($$self, $$props, $$invalidate) {
	let { input } = $$props;

	$$self.$$set = $$props => {
		if ('input' in $$props) $$invalidate(0, input = $$props.input);
	};

	return [input];
}

class SystemBlock extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$2, create_fragment$2, safe_not_equal, { input: 0 }, add_css$2);
	}
}

/* src/UserBlock.svelte generated by Svelte v3.59.2 */

function add_css$1(target) {
	append_styles(target, "svelte-1a18bkt", ".box.svelte-1a18bkt.svelte-1a18bkt{margin-top:5px;margin-bottom:5px;display:flex;justify-content:end;align-items:end;position:relative;z-index:1}.box.svelte-1a18bkt svg.svelte-1a18bkt{min-width:15px;width:15px;margin-left:10px;margin-top:7px;fill:var(--G3)}.chat.svelte-1a18bkt.svelte-1a18bkt{border:1px solid rgba(224, 224, 224, 1);border-radius:5px;margin:0px;padding:10px;overflow-wrap:anywhere;max-width:70%}.message.svelte-1a18bkt.svelte-1a18bkt{position:relative;word-wrap:break-word;align-self:flex-start;background-color:white}.message.svelte-1a18bkt.svelte-1a18bkt::before{width:20px;right:-7px;background-color:rgba(224, 224, 224, 1);border-bottom-left-radius:16px 14px;position:absolute;bottom:0;height:25px;content:\"\";z-index:-1}.message.svelte-1a18bkt.svelte-1a18bkt::after{width:10px;background-color:white;right:-11px;border-bottom-left-radius:10px;position:absolute;bottom:0;height:25px;content:\"\";z-index:-1}");
}

function create_fragment$1(ctx) {
	let div;
	let p;
	let t0;
	let t1;
	let svg;
	let path;

	return {
		c() {
			div = element("div");
			p = element("p");
			t0 = text(/*input*/ ctx[0]);
			t1 = space();
			svg = svg_element("svg");
			path = svg_element("path");
			this.h();
		},
		l(nodes) {
			div = claim_element(nodes, "DIV", { class: true });
			var div_nodes = children(div);
			p = claim_element(div_nodes, "P", { class: true });
			var p_nodes = children(p);
			t0 = claim_text(p_nodes, /*input*/ ctx[0]);
			p_nodes.forEach(detach);
			t1 = claim_space(div_nodes);
			svg = claim_svg_element(div_nodes, "svg", { xmlns: true, viewBox: true, class: true });
			var svg_nodes = children(svg);
			path = claim_svg_element(svg_nodes, "path", { d: true });
			children(path).forEach(detach);
			svg_nodes.forEach(detach);
			div_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(p, "class", "chat message svelte-1a18bkt");
			attr(path, "d", "M224 256A128 128 0 1 0 224 0a128 128 0 1 0 0 256zm-45.7 48C79.8 304 0 383.8 0 482.3C0 498.7 13.3 512 29.7 512H418.3c16.4 0 29.7-13.3 29.7-29.7C448 383.8 368.2 304 269.7 304H178.3z");
			attr(svg, "xmlns", "http://www.w3.org/2000/svg");
			attr(svg, "viewBox", "0 0 448 512");
			attr(svg, "class", "svelte-1a18bkt");
			attr(div, "class", "box svelte-1a18bkt");
		},
		m(target, anchor) {
			insert_hydration(target, div, anchor);
			append_hydration(div, p);
			append_hydration(p, t0);
			append_hydration(div, t1);
			append_hydration(div, svg);
			append_hydration(svg, path);
		},
		p(ctx, [dirty]) {
			if (dirty & /*input*/ 1) set_data(t0, /*input*/ ctx[0]);
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(div);
		}
	};
}

function instance$1($$self, $$props, $$invalidate) {
	let { input } = $$props;

	$$self.$$set = $$props => {
		if ('input' in $$props) $$invalidate(0, input = $$props.input);
	};

	return [input];
}

class UserBlock extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$1, create_fragment$1, safe_not_equal, { input: 0 }, add_css$1);
	}
}

/* src/InstanceView.svelte generated by Svelte v3.59.2 */

function add_css(target) {
	append_styles(target, "svelte-nmpn29", "#container.svelte-nmpn29.svelte-nmpn29{display:flex;flex-direction:column;border:1px solid rgb(224, 224, 224);min-width:350px;max-width:550px;border-radius:2px;padding:10px;margin:2.5px}.label.svelte-nmpn29.svelte-nmpn29{font-weight:500}.show-all.svelte-nmpn29.svelte-nmpn29{align-self:center;border:none;background-color:transparent;cursor:pointer;display:flex;align-items:center;padding:5px;margin-top:-7px;border-radius:20px}.hover.svelte-nmpn29.svelte-nmpn29{background-color:var(--G5)}.show-all.svelte-nmpn29 span.svelte-nmpn29{padding-right:5px}.show-all.svelte-nmpn29 svg.svelte-nmpn29{min-width:24px;width:24px;fill:var(--G3)}.expected.svelte-nmpn29.svelte-nmpn29{overflow-wrap:break-word;display:flex;flex-direction:column;margin-left:-10px;margin-bottom:-10px;margin-right:-10px;padding:5px;font-size:small;margin-top:10px;border-top:0.5px solid rgb(224, 224, 224)}");
}

function get_each_context(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[14] = list[i];
	return child_ctx;
}

// (26:2) {#if !showall}
function create_if_block_7(ctx) {
	let div;
	let svg;
	let path;
	let t0;
	let span;
	let t1;
	let mounted;
	let dispose;

	return {
		c() {
			div = element("div");
			svg = svg_element("svg");
			path = svg_element("path");
			t0 = space();
			span = element("span");
			t1 = text("Show All");
			this.h();
		},
		l(nodes) {
			div = claim_element(nodes, "DIV", { class: true });
			var div_nodes = children(div);
			svg = claim_svg_element(div_nodes, "svg", { xmlns: true, viewBox: true, class: true });
			var svg_nodes = children(svg);
			path = claim_svg_element(svg_nodes, "path", { d: true });
			children(path).forEach(detach);
			svg_nodes.forEach(detach);
			t0 = claim_space(div_nodes);
			span = claim_element(div_nodes, "SPAN", { class: true });
			var span_nodes = children(span);
			t1 = claim_text(span_nodes, "Show All");
			span_nodes.forEach(detach);
			div_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(path, "d", "m12 8-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z");
			attr(svg, "xmlns", "http://www.w3.org/2000/svg");
			attr(svg, "viewBox", "0 0 24 24");
			attr(svg, "class", "svelte-nmpn29");
			attr(span, "class", "svelte-nmpn29");
			attr(div, "class", "show-all svelte-nmpn29");
			toggle_class(div, "hover", /*hovered*/ ctx[5]);
		},
		m(target, anchor) {
			insert_hydration(target, div, anchor);
			append_hydration(div, svg);
			append_hydration(svg, path);
			append_hydration(div, t0);
			append_hydration(div, span);
			append_hydration(span, t1);

			if (!mounted) {
				dispose = [
					listen(div, "click", /*click_handler*/ ctx[9]),
					listen(div, "keydown", keydown_handler),
					listen(div, "focus", /*focus_handler*/ ctx[10]),
					listen(div, "blur", /*blur_handler*/ ctx[11]),
					listen(div, "mouseover", /*mouseover_handler*/ ctx[12]),
					listen(div, "mouseout", /*mouseout_handler*/ ctx[13])
				];

				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (dirty & /*hovered*/ 32) {
				toggle_class(div, "hover", /*hovered*/ ctx[5]);
			}
		},
		d(detaching) {
			if (detaching) detach(div);
			mounted = false;
			run_all(dispose);
		}
	};
}

// (43:2) {#if entry[dataColumn]}
function create_if_block_2(ctx) {
	let current_block_type_index;
	let if_block;
	let if_block_anchor;
	let current;
	const if_block_creators = [create_if_block_3, create_else_block];
	const if_blocks = [];

	function select_block_type(ctx, dirty) {
		if (typeof /*entry*/ ctx[0][/*dataColumn*/ ctx[3]] === "string") return 0;
		return 1;
	}

	current_block_type_index = select_block_type(ctx);
	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

	return {
		c() {
			if_block.c();
			if_block_anchor = empty();
		},
		l(nodes) {
			if_block.l(nodes);
			if_block_anchor = empty();
		},
		m(target, anchor) {
			if_blocks[current_block_type_index].m(target, anchor);
			insert_hydration(target, if_block_anchor, anchor);
			current = true;
		},
		p(ctx, dirty) {
			let previous_block_index = current_block_type_index;
			current_block_type_index = select_block_type(ctx);

			if (current_block_type_index === previous_block_index) {
				if_blocks[current_block_type_index].p(ctx, dirty);
			} else {
				group_outros();

				transition_out(if_blocks[previous_block_index], 1, 1, () => {
					if_blocks[previous_block_index] = null;
				});

				check_outros();
				if_block = if_blocks[current_block_type_index];

				if (!if_block) {
					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
					if_block.c();
				} else {
					if_block.p(ctx, dirty);
				}

				transition_in(if_block, 1);
				if_block.m(if_block_anchor.parentNode, if_block_anchor);
			}
		},
		i(local) {
			if (current) return;
			transition_in(if_block);
			current = true;
		},
		o(local) {
			transition_out(if_block);
			current = false;
		},
		d(detaching) {
			if_blocks[current_block_type_index].d(detaching);
			if (detaching) detach(if_block_anchor);
		}
	};
}

// (46:4) {:else}
function create_else_block(ctx) {
	let each_1_anchor;
	let current;
	let each_value = /*entries*/ ctx[6];
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
	}

	const out = i => transition_out(each_blocks[i], 1, 1, () => {
		each_blocks[i] = null;
	});

	return {
		c() {
			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			each_1_anchor = empty();
		},
		l(nodes) {
			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].l(nodes);
			}

			each_1_anchor = empty();
		},
		m(target, anchor) {
			for (let i = 0; i < each_blocks.length; i += 1) {
				if (each_blocks[i]) {
					each_blocks[i].m(target, anchor);
				}
			}

			insert_hydration(target, each_1_anchor, anchor);
			current = true;
		},
		p(ctx, dirty) {
			if (dirty & /*entries*/ 64) {
				each_value = /*entries*/ ctx[6];
				let i;

				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
						transition_in(each_blocks[i], 1);
					} else {
						each_blocks[i] = create_each_block(child_ctx);
						each_blocks[i].c();
						transition_in(each_blocks[i], 1);
						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
					}
				}

				group_outros();

				for (i = each_value.length; i < each_blocks.length; i += 1) {
					out(i);
				}

				check_outros();
			}
		},
		i(local) {
			if (current) return;

			for (let i = 0; i < each_value.length; i += 1) {
				transition_in(each_blocks[i]);
			}

			current = true;
		},
		o(local) {
			each_blocks = each_blocks.filter(Boolean);

			for (let i = 0; i < each_blocks.length; i += 1) {
				transition_out(each_blocks[i]);
			}

			current = false;
		},
		d(detaching) {
			destroy_each(each_blocks, detaching);
			if (detaching) detach(each_1_anchor);
		}
	};
}

// (44:4) {#if typeof entry[dataColumn] === "string"}
function create_if_block_3(ctx) {
	let userblock;
	let current;

	userblock = new UserBlock({
			props: {
				input: /*entry*/ ctx[0][/*dataColumn*/ ctx[3]]
			}
		});

	return {
		c() {
			create_component(userblock.$$.fragment);
		},
		l(nodes) {
			claim_component(userblock.$$.fragment, nodes);
		},
		m(target, anchor) {
			mount_component(userblock, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const userblock_changes = {};
			if (dirty & /*entry, dataColumn*/ 9) userblock_changes.input = /*entry*/ ctx[0][/*dataColumn*/ ctx[3]];
			userblock.$set(userblock_changes);
		},
		i(local) {
			if (current) return;
			transition_in(userblock.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(userblock.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(userblock, detaching);
		}
	};
}

// (52:42) 
function create_if_block_6(ctx) {
	let userblock;
	let current;

	userblock = new UserBlock({
			props: { input: /*item*/ ctx[14]["content"] }
		});

	return {
		c() {
			create_component(userblock.$$.fragment);
		},
		l(nodes) {
			claim_component(userblock.$$.fragment, nodes);
		},
		m(target, anchor) {
			mount_component(userblock, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const userblock_changes = {};
			if (dirty & /*entries*/ 64) userblock_changes.input = /*item*/ ctx[14]["content"];
			userblock.$set(userblock_changes);
		},
		i(local) {
			if (current) return;
			transition_in(userblock.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(userblock.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(userblock, detaching);
		}
	};
}

// (50:47) 
function create_if_block_5(ctx) {
	let assistantblock;
	let current;

	assistantblock = new AssistantBlock({
			props: { input: /*item*/ ctx[14]["content"] }
		});

	return {
		c() {
			create_component(assistantblock.$$.fragment);
		},
		l(nodes) {
			claim_component(assistantblock.$$.fragment, nodes);
		},
		m(target, anchor) {
			mount_component(assistantblock, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const assistantblock_changes = {};
			if (dirty & /*entries*/ 64) assistantblock_changes.input = /*item*/ ctx[14]["content"];
			assistantblock.$set(assistantblock_changes);
		},
		i(local) {
			if (current) return;
			transition_in(assistantblock.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(assistantblock.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(assistantblock, detaching);
		}
	};
}

// (48:8) {#if item["role"] === "system"}
function create_if_block_4(ctx) {
	let systemblock;
	let current;

	systemblock = new SystemBlock({
			props: { input: /*item*/ ctx[14]["content"] }
		});

	return {
		c() {
			create_component(systemblock.$$.fragment);
		},
		l(nodes) {
			claim_component(systemblock.$$.fragment, nodes);
		},
		m(target, anchor) {
			mount_component(systemblock, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const systemblock_changes = {};
			if (dirty & /*entries*/ 64) systemblock_changes.input = /*item*/ ctx[14]["content"];
			systemblock.$set(systemblock_changes);
		},
		i(local) {
			if (current) return;
			transition_in(systemblock.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(systemblock.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(systemblock, detaching);
		}
	};
}

// (47:6) {#each entries as item}
function create_each_block(ctx) {
	let current_block_type_index;
	let if_block;
	let if_block_anchor;
	let current;
	const if_block_creators = [create_if_block_4, create_if_block_5, create_if_block_6];
	const if_blocks = [];

	function select_block_type_1(ctx, dirty) {
		if (/*item*/ ctx[14]["role"] === "system") return 0;
		if (/*item*/ ctx[14]["role"] === "assistant") return 1;
		if (/*item*/ ctx[14]["role"] === "user") return 2;
		return -1;
	}

	if (~(current_block_type_index = select_block_type_1(ctx))) {
		if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
	}

	return {
		c() {
			if (if_block) if_block.c();
			if_block_anchor = empty();
		},
		l(nodes) {
			if (if_block) if_block.l(nodes);
			if_block_anchor = empty();
		},
		m(target, anchor) {
			if (~current_block_type_index) {
				if_blocks[current_block_type_index].m(target, anchor);
			}

			insert_hydration(target, if_block_anchor, anchor);
			current = true;
		},
		p(ctx, dirty) {
			let previous_block_index = current_block_type_index;
			current_block_type_index = select_block_type_1(ctx);

			if (current_block_type_index === previous_block_index) {
				if (~current_block_type_index) {
					if_blocks[current_block_type_index].p(ctx, dirty);
				}
			} else {
				if (if_block) {
					group_outros();

					transition_out(if_blocks[previous_block_index], 1, 1, () => {
						if_blocks[previous_block_index] = null;
					});

					check_outros();
				}

				if (~current_block_type_index) {
					if_block = if_blocks[current_block_type_index];

					if (!if_block) {
						if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
						if_block.c();
					} else {
						if_block.p(ctx, dirty);
					}

					transition_in(if_block, 1);
					if_block.m(if_block_anchor.parentNode, if_block_anchor);
				} else {
					if_block = null;
				}
			}
		},
		i(local) {
			if (current) return;
			transition_in(if_block);
			current = true;
		},
		o(local) {
			transition_out(if_block);
			current = false;
		},
		d(detaching) {
			if (~current_block_type_index) {
				if_blocks[current_block_type_index].d(detaching);
			}

			if (detaching) detach(if_block_anchor);
		}
	};
}

// (58:2) {#if entry[modelColumn]}
function create_if_block_1(ctx) {
	let assistantblock;
	let current;

	assistantblock = new AssistantBlock({
			props: {
				input: /*entry*/ ctx[0][/*modelColumn*/ ctx[1]],
				output: true
			}
		});

	return {
		c() {
			create_component(assistantblock.$$.fragment);
		},
		l(nodes) {
			claim_component(assistantblock.$$.fragment, nodes);
		},
		m(target, anchor) {
			mount_component(assistantblock, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const assistantblock_changes = {};
			if (dirty & /*entry, modelColumn*/ 3) assistantblock_changes.input = /*entry*/ ctx[0][/*modelColumn*/ ctx[1]];
			assistantblock.$set(assistantblock_changes);
		},
		i(local) {
			if (current) return;
			transition_in(assistantblock.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(assistantblock.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(assistantblock, detaching);
		}
	};
}

// (61:2) {#if entry[labelColumn]}
function create_if_block(ctx) {
	let div;
	let span0;
	let t0;
	let t1;
	let span1;
	let t2_value = /*entry*/ ctx[0][/*labelColumn*/ ctx[2]] + "";
	let t2;

	return {
		c() {
			div = element("div");
			span0 = element("span");
			t0 = text("Expected:");
			t1 = space();
			span1 = element("span");
			t2 = text(t2_value);
			this.h();
		},
		l(nodes) {
			div = claim_element(nodes, "DIV", { class: true });
			var div_nodes = children(div);
			span0 = claim_element(div_nodes, "SPAN", { class: true });
			var span0_nodes = children(span0);
			t0 = claim_text(span0_nodes, "Expected:");
			span0_nodes.forEach(detach);
			t1 = claim_space(div_nodes);
			span1 = claim_element(div_nodes, "SPAN", {});
			var span1_nodes = children(span1);
			t2 = claim_text(span1_nodes, t2_value);
			span1_nodes.forEach(detach);
			div_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(span0, "class", "label svelte-nmpn29");
			attr(div, "class", "expected svelte-nmpn29");
		},
		m(target, anchor) {
			insert_hydration(target, div, anchor);
			append_hydration(div, span0);
			append_hydration(span0, t0);
			append_hydration(div, t1);
			append_hydration(div, span1);
			append_hydration(span1, t2);
		},
		p(ctx, dirty) {
			if (dirty & /*entry, labelColumn*/ 5 && t2_value !== (t2_value = /*entry*/ ctx[0][/*labelColumn*/ ctx[2]] + "")) set_data(t2, t2_value);
		},
		d(detaching) {
			if (detaching) detach(div);
		}
	};
}

function create_fragment(ctx) {
	let div;
	let t0;
	let t1;
	let t2;
	let current;
	let if_block0 = !/*showall*/ ctx[4] && create_if_block_7(ctx);
	let if_block1 = /*entry*/ ctx[0][/*dataColumn*/ ctx[3]] && create_if_block_2(ctx);
	let if_block2 = /*entry*/ ctx[0][/*modelColumn*/ ctx[1]] && create_if_block_1(ctx);
	let if_block3 = /*entry*/ ctx[0][/*labelColumn*/ ctx[2]] && create_if_block(ctx);

	return {
		c() {
			div = element("div");
			if (if_block0) if_block0.c();
			t0 = space();
			if (if_block1) if_block1.c();
			t1 = space();
			if (if_block2) if_block2.c();
			t2 = space();
			if (if_block3) if_block3.c();
			this.h();
		},
		l(nodes) {
			div = claim_element(nodes, "DIV", { id: true, class: true });
			var div_nodes = children(div);
			if (if_block0) if_block0.l(div_nodes);
			t0 = claim_space(div_nodes);
			if (if_block1) if_block1.l(div_nodes);
			t1 = claim_space(div_nodes);
			if (if_block2) if_block2.l(div_nodes);
			t2 = claim_space(div_nodes);
			if (if_block3) if_block3.l(div_nodes);
			div_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(div, "id", "container");
			attr(div, "class", "svelte-nmpn29");
		},
		m(target, anchor) {
			insert_hydration(target, div, anchor);
			if (if_block0) if_block0.m(div, null);
			append_hydration(div, t0);
			if (if_block1) if_block1.m(div, null);
			append_hydration(div, t1);
			if (if_block2) if_block2.m(div, null);
			append_hydration(div, t2);
			if (if_block3) if_block3.m(div, null);
			current = true;
		},
		p(ctx, [dirty]) {
			if (!/*showall*/ ctx[4]) {
				if (if_block0) {
					if_block0.p(ctx, dirty);
				} else {
					if_block0 = create_if_block_7(ctx);
					if_block0.c();
					if_block0.m(div, t0);
				}
			} else if (if_block0) {
				if_block0.d(1);
				if_block0 = null;
			}

			if (/*entry*/ ctx[0][/*dataColumn*/ ctx[3]]) {
				if (if_block1) {
					if_block1.p(ctx, dirty);

					if (dirty & /*entry, dataColumn*/ 9) {
						transition_in(if_block1, 1);
					}
				} else {
					if_block1 = create_if_block_2(ctx);
					if_block1.c();
					transition_in(if_block1, 1);
					if_block1.m(div, t1);
				}
			} else if (if_block1) {
				group_outros();

				transition_out(if_block1, 1, 1, () => {
					if_block1 = null;
				});

				check_outros();
			}

			if (/*entry*/ ctx[0][/*modelColumn*/ ctx[1]]) {
				if (if_block2) {
					if_block2.p(ctx, dirty);

					if (dirty & /*entry, modelColumn*/ 3) {
						transition_in(if_block2, 1);
					}
				} else {
					if_block2 = create_if_block_1(ctx);
					if_block2.c();
					transition_in(if_block2, 1);
					if_block2.m(div, t2);
				}
			} else if (if_block2) {
				group_outros();

				transition_out(if_block2, 1, 1, () => {
					if_block2 = null;
				});

				check_outros();
			}

			if (/*entry*/ ctx[0][/*labelColumn*/ ctx[2]]) {
				if (if_block3) {
					if_block3.p(ctx, dirty);
				} else {
					if_block3 = create_if_block(ctx);
					if_block3.c();
					if_block3.m(div, null);
				}
			} else if (if_block3) {
				if_block3.d(1);
				if_block3 = null;
			}
		},
		i(local) {
			if (current) return;
			transition_in(if_block1);
			transition_in(if_block2);
			current = true;
		},
		o(local) {
			transition_out(if_block1);
			transition_out(if_block2);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(div);
			if (if_block0) if_block0.d();
			if (if_block1) if_block1.d();
			if (if_block2) if_block2.d();
			if (if_block3) if_block3.d();
		}
	};
}

const keydown_handler = () => {
	
};

function instance($$self, $$props, $$invalidate) {
	let entries;
	let { options } = $$props;
	let { entry } = $$props;
	let { modelColumn } = $$props;
	let { labelColumn } = $$props;
	let { dataColumn } = $$props;
	let { idColumn } = $$props;
	let showall = entry[dataColumn].length <= 5;
	let hovered = false;
	const click_handler = () => $$invalidate(4, showall = true);
	const focus_handler = () => $$invalidate(5, hovered = true);
	const blur_handler = () => $$invalidate(5, hovered = false);
	const mouseover_handler = () => $$invalidate(5, hovered = true);
	const mouseout_handler = () => $$invalidate(5, hovered = false);

	$$self.$$set = $$props => {
		if ('options' in $$props) $$invalidate(7, options = $$props.options);
		if ('entry' in $$props) $$invalidate(0, entry = $$props.entry);
		if ('modelColumn' in $$props) $$invalidate(1, modelColumn = $$props.modelColumn);
		if ('labelColumn' in $$props) $$invalidate(2, labelColumn = $$props.labelColumn);
		if ('dataColumn' in $$props) $$invalidate(3, dataColumn = $$props.dataColumn);
		if ('idColumn' in $$props) $$invalidate(8, idColumn = $$props.idColumn);
	};

	$$self.$$.update = () => {
		if ($$self.$$.dirty & /*showall, entry, dataColumn*/ 25) {
			$$invalidate(6, entries = showall
			? entry[dataColumn]
			: entry[dataColumn].slice(-4));
		}
	};

	return [
		entry,
		modelColumn,
		labelColumn,
		dataColumn,
		showall,
		hovered,
		entries,
		options,
		idColumn,
		click_handler,
		focus_handler,
		blur_handler,
		mouseover_handler,
		mouseout_handler
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
				options: 7,
				entry: 0,
				modelColumn: 1,
				labelColumn: 2,
				dataColumn: 3,
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
