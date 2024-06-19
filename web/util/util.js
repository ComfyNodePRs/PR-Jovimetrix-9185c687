/**
 * File: util.js
 * Project: Jovimetrix
 *
 */
/*
parse a json into a graph
const workflow = JSON.parse(json);
await this.loadGraphData(workflow);
*/

export const TypeSlot = {
    Input: 1,
    Output: 2,
};

export const TypeSlotEvent = {
    Connect: true,
    Disconnect: false,
};

export function getConfig(widgetName) {
	const { nodeData } = this.constructor;
	return nodeData?.input?.required[widgetName] ?? nodeData?.input?.optional?.[widgetName];
}

export const node_cleanup = (node) => {
    if (!node.widgets || !node.widgets?.[Symbol.iterator]) {
        return
    }
    for (const w of node.widgets) {
        if (w.canvas) {
            w.canvas.remove()
        }
        if (w.inputEl) {
            w.inputEl.remove()
        }
        w.onRemoved?.()
    }
}

export function node_mouse_pos(app, node) {
	return [
		app.canvas.graph_mouse[0] - node.pos[0],
		app.canvas.graph_mouse[1] - node.pos[1],
	];
}

export function fitHeight(node, skipSize=false) {
    node.onResize?.(node.size);
    if (!skipSize) {
        node.setSize([node.size[0], node.computeSize([node.size[0], node.size[1]])[1]]);
    }
    node?.graph?.setDirtyCanvas(true, true);
}

/**
 * Manage the slots on a node to allow a dynamic number of inputs
*/
export function node_add_dynamic(nodeType, prefix, dynamic_type='*', index_start=0, match_output=false, refresh=true) {
    /*
    this one should just put the "prefix" as the last empty entry.
    Means we have to pay attention not to collide key names in the
    input list.

    Also need to make sure that we keep any non-dynamic ports.
    */

    // clean off missing slot connects
    function clean_inputs(self, slot_idx) {
        if (self.graph === undefined) {
            return;
        }

        let idx = index_start;
        let slot_count = index_start;
        let count = self.inputs.length;
        while (idx < self.inputs.length-1 && count > 0) {
            const slot = self.inputs[idx];
            // console.info(slot, count)
            if (slot) {
                const parts = slot.name.split('_');
                // a dynamic jovian slot prefix_
                if (parts.length > 1) {
                    if (slot.link == null) {
                        if (match_output && slot_idx < self.outputs?.length) {
                            self.removeOutput(slot_idx);
                        }
                        if (slot_idx < self.inputs?.length) {
                            self.removeInput(slot_idx);
                        }
                    } else {
                        const name = parts.slice(1).join('_');
                        self.inputs[idx].name = `${slot_count}_${name}`;
                        slot_count += 1;
                        idx += 1;
                    }
                } else {
                    idx += 1;
                }
            }
            count -= 1;
        }
        //console.info(idx)
    }

    index_start = Math.max(0, index_start);
    const onNodeCreated = nodeType.prototype.onNodeCreated
    nodeType.prototype.onNodeCreated = function () {
        const me = onNodeCreated?.apply(this);
        this.addInput(prefix, dynamic_type);
        if (match_output) {
		    this.addOutput(prefix, dynamic_type); //, { shape: shape });
        }
        return me;
    }

    const onConnectionsChange = nodeType.prototype.onConnectionsChange
    nodeType.prototype.onConnectionsChange = function (slotType, slot_idx, event, link_info, node_slot) {
        const me = onConnectionsChange?.apply(this, arguments);
        if (slotType === TypeSlot.Input) {
            if (slot_idx >= index_start) {
                if (link_info) {
                if (event === TypeSlotEvent.Connect) {
                    const fromNode = this.graph._nodes.find(
                        (otherNode) => otherNode.id == link_info.origin_id
                    )
                    if (fromNode) {
                        const parent_link = fromNode.outputs[link_info.origin_slot];
                        if (parent_link) {
                            node_slot.type = parent_link.type;
                            node_slot.name = `_${parent_link.name}`;
                            if (match_output) {
                                const slot_out = this.outputs[slot_idx];
                                slot_out.type = parent_link.type;
                                slot_out.name = `${parent_link.type}`;
                            }
                        }
                    }
                }
                }

                // check that the last slot is a dynamic entry....
                let last = this.inputs[this.inputs.length-1];
                if (last.type != dynamic_type || last.name != prefix) {
                    this.addInput(prefix, dynamic_type);
                }
                if (match_output) {
                    last = this.outputs[this.outputs.length-1];
                    if (last.type != dynamic_type || last.name != prefix) {
                        this.addOutput(prefix, dynamic_type);
                    }
                };

                if (refresh) {
                    setTimeout(() => {
                        clean_inputs(this, slot_idx);
                    }, 5);
                }
            }
        }
        return me;
    }
    return nodeType;
}

export function convertArrayToObject(values, length, parseFn) {
    const result = {};
    for (let i = 0; i < length; i++) {
        result[i] = parseFn(values[i]);
    }
    return result;
}

export function showModal(innerHTML, eventCallback, timeout=null) {
    return new Promise((resolve, reject) => {
        const modal = document.createElement("div");
        modal.className = "modal";
        modal.innerHTML = innerHTML;
        document.body.appendChild(modal);

        // center
        const modalContent = modal.querySelector(".jov-modal-content");
        modalContent.style.position = "absolute";
        modalContent.style.left = "50%";
        modalContent.style.top = "50%";
        modalContent.style.transform = "translate(-50%, -50%)";

        let timeoutId;

        const handleEvent = (event) => {
            const targetId = event.target.id;
            const result = eventCallback(targetId);

            if (result != null) {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }
                modal.remove();
                resolve(result);
            }
        };
        modalContent.addEventListener("click", handleEvent);
        modalContent.addEventListener("dblclick", handleEvent);

        if (timeout) {
            timeout *= 1000;
            timeoutId = setTimeout(() => {
                modal.remove();
                reject(new Error("TIMEOUT"));
            }, timeout);
        }

        //setTimeout(() => {
        //    modal.dispatchEvent(new Event('tick'));
        //}, 1000);
    });
}
