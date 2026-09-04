const finite = n => Number.isFinite(n) ? n : 0;

/** FPS look only accepts relative input from a genuinely captured pointer. */
export class MouseLook {
  reset() {}
  move(event,{locked=false}={}) {
    return locked?{x:finite(event.movementX),y:finite(event.movementY)}:{x:0,y:0};
  }
}
