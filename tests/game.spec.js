import { test, expect } from "@playwright/test";
import fs from 'node:fs/promises';
import path from 'node:path';

test("survival: real start, ZQSD, jump, inventory, mouse mining and placement, save/reload", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?qa=1");
  await page.waitForFunction(() => !!window.__minecrack);
  await expect(
    page.getByRole("button", { name: "Jouer", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Jouer", exact: true }).click();
  await page.waitForFunction(() => !window.__minecrack.game.paused);
  const p0 = await page.evaluate(() => window.__minecrack.snapshot().position);
  await page.keyboard.down("w");
  await page.waitForFunction(
    (z) => window.__minecrack.game.player.position.z < z - 0.4,
    p0[2],
  );
  await page.keyboard.up("w");
  const y0 = await page.evaluate(
    () => window.__minecrack.game.player.position.y,
  );
  await page.keyboard.down("Space");
  await page.waitForFunction(
    (y) => window.__minecrack.game.player.position.y > y + 0.5,
    y0,
  );
  await page.keyboard.up("Space");
  await page.keyboard.press("e");
  await expect(
    page.getByRole("dialog", { name: "Dans vos poches.", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("e");
  await page.waitForFunction(() => !window.__minecrack.game.paused);
  await page.mouse.move(768, 432);
  const target = await page.evaluate(() => {
    const g = window.__minecrack.game;
    g.player.reset(g.world.spawn);
    g.player.pitch = -1.1;
    g.player.updateCamera();
    g.updateTarget();
    return (
      g.target && {
        q: g.target.q,
        r: g.target.r,
        y: g.target.y,
        type: g.target.type,
      }
    );
  });
  expect(target).toBeTruthy();
  await page.mouse.down();
  await page
    .waitForFunction(
      (t) => !window.__minecrack.game.world.getBlock(t.q, t.r, t.y),
      target,
      { timeout: 6000 },
    )
    .catch(async (e) => {
      console.log(
        "MINING STATE",
        await page.evaluate(() => {
          const g = window.__minecrack.game;
          return {
            paused: g.paused,
            locked: !!document.pointerLockElement,
            fallback: g.mouseFallback,
            left: g.leftHeld,
            progress: g.miningProgress,
            target: g.target,
            entity: !!g.entityTarget,
            position: g.player.position.toArray(),
            inv: g.inv.counts,
          };
        }),
        target,
      );
      throw e;
    });
  await page.mouse.up();
  const mined = await page.evaluate(
    () => window.__minecrack.game.inv.counts.grass,
  );
  expect(mined).toBeGreaterThan(12);
  await page.keyboard.press("2");
  const place = await page.evaluate(() => {
    const g = window.__minecrack.game;
    g.player.position.y = g.world.getGroundHeight(
      g.player.position.x,
      g.player.position.z,
    );
    g.player.pitch = -0.5;
    g.player.updateCamera();
    g.updateTarget();
    return g.target?.place;
  });
  expect(place).toBeTruthy();
  await page.mouse.click(768, 432, { button: "right" });
  await page
    .waitForFunction(
      (c) =>
        window.__minecrack.game.world.getBlock(c.q, c.r, c.y)?.type === "grass",
      place,
      { timeout: 6000 },
    )
    .catch(async (e) => {
      console.log(
        "PLACEMENT STATE",
        await page.evaluate(() => {
          const g = window.__minecrack.game;
          return {
            paused: g.paused,
            target: g.target,
            selected: g.inv.active,
            position: g.player.position.toArray(),
            counts: g.inv.counts,
          };
        }),
        place,
      );
      throw e;
    });
  await page.evaluate(() => {
    window.__minecrack.game.inv.add("cuir", 7);
    window.__minecrack.game.save();
  });
  await page.reload();
  await page
    .getByRole("button", { name: "Continuer l’aventure", exact: true })
    .click();
  await page.waitForFunction(
    () => window.__minecrack.game.inv.counts.cuir === 7,
  );
  expect(
    await page.evaluate(
      () =>
        window.__minecrack.game.world.getBlock(
          ...Object.values({ q: 0, r: 0, y: 0 }),
        ).type,
    ),
  ).toBe("bedrock");
  expect(errors).toEqual([]);
});

test("all Lucky outcomes exist, gameplay effects work and save persists entities", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?qa=1");
  await page.waitForFunction(() => !!window.__minecrack);
  const outcome = await page.evaluate(() => {
    const api = window.__minecrack,
      g = api.game;
    api.start("survival");
    g.paused = true;
    const result = {},
      ids = [
        "chocolatine",
        "cuir",
        "poche",
        "impots",
        "journal",
        "urssaf",
        "nucleaire",
        "b2",
        "socialiste",
        "cb12",
        "zerator",
        "gnome",
        "megaphone",
        "tgv",
        "furry",
        "radio",
      ];
    for (const id of ids) {
      api.lucky(id);
      result[id] =
        g.discovered.has(id) &&
        g.entities.all.some(
          (e) => e.item === id || e.kind === (id === "urssaf" ? "hostile" : id),
        );
    }
    g.entities.clear();
    for (const id of ids) g.inv.add(id, 10);
    const use = (id) => {
      api.use(id);
      if(g.itemUse.active){
        g.rightHeld=true;
        for(let i=0;i<100&&g.itemUse.active;i++)g.updateUse(.02);
        g.rightHeld=false;g.cancelUse();
      }
    };
    g.health = 40;
    g.hunger = 30;
    use("chocolatine");
    result.food = g.health === 62 && g.hunger === 62;
    use("cb12");
    result.cb12 = g.health === 97 && g.hunger === 100;
    use("impots");
    const health = g.health;
    g.hurt(80);
    result.impots = g.health === health && g.invulnerable();
    use("furry");
    result.furry = !!g.buffs.furry;
    use("journal");
    result.journal = g.entities.projectiles.length === 1;
    g.entities.clear();
    g.player.pitch = -0.8;
    g.player.updateCamera();
    g.updateTarget();
    use("gnome");
    result.gnome = g.entities.all.some((e) => e.kind === "gnome");
    g.entities.clear();
    use("radio");
    result.radio = g.entities.all.some((e) => e.kind === "radio");
    g.entities.clear();
    use("nucleaire");
    const plant = g.entities.all.find((e) => e.kind === "nucleaire");
    result.nucleaire = !!plant?.beam;
    g.entities.clear();
    use("b2");
    const jet = g.entities.all.find((e) => e.kind === "b2");
    for (let n = 0; n < 100; n++) g.entities.update(0.016);
    result.b2 = !!jet && g.entities.projectiles.length > 0;
    g.entities.clear();
    use("zerator");
    result.zerator = g.entities.all.some((e) => e.kind === "friend");
    g.entities.clear();
    use("urssaf");
    const enemy = g.entities.all.find((e) => e.kind === "hostile");
    result.urssaf = !!enemy;
    enemy.model.position.copy(g.player.position).add({ x: 0, y: 0, z: -1.4 });
    g.buffs.impots = 0;
    const ore = (g.inv.counts.ore = 12);
    g.entities.update(0.02);
    result.theftTiming=g.inv.counts.ore===ore;
    g.entities.update(0.19);
    result.theft = g.inv.counts.ore === ore - 3 && enemy.inventory.ore === 3;
    g.player.pitch = -0.15;
    g.player.updateCamera();
    const before = enemy.health;
    use("poche");
    g.lastAttack=-Infinity;g.attack();
    const healthBeforeContact=enemy.health;
    for(let i=0;i<12;i++)g.strike(g.viewModel.update(1/60,{time:g.time}));
    result.contactTiming=healthBeforeContact===before;
    result.poche = enemy.health < before;
    enemy.model.position.copy(g.player.position).add({ x: 0, y: 0, z: -3 });
    const oldZ = enemy.model.position.z;
    use("megaphone");
    const feared=enemy.fear===2;
    for(let i=0;i<15;i++)g.entities.update(1/60);
    result.megaphone = feared && enemy.model.position.z !== oldZ;
    use("tgv");
    result.tgv = enemy.fear === 10;
    enemy.model.position.copy(g.player.position).add({ x: 0, y: 0, z: -2 });
    g.inv.counts.wood = 11;
    enemy.inventory.wood = 0;
    g.shareResources();
    result.socialiste = g.inv.counts.wood === 6 && enemy.inventory.wood === 5;
    g.inv.counts.cuir = 5;
    result.crafting = g.inv.craft("furry") && g.inv.counts.cuir === 0;
    const beforeSave = g.entities.serialize();
    g.save();
    g.load();
    result.persistence =
      JSON.stringify(g.entities.serialize()) === JSON.stringify(beforeSave);
    return result;
  });
  expect(outcome).toEqual(
    Object.fromEntries(Object.keys(outcome).map((k) => [k, true])),
  );
  expect(errors).toEqual([]);
});

test("production game surface loads every local HD texture without external runtime dependencies", async ({
  page,
}) => {
  const failures = [];
  page.on("response", (r) => {
    if (r.status() >= 400) failures.push(r.url());
  });
  await page.goto("/?qa=1");
  await page.waitForFunction(() => !!window.__minecrack);
  await page.evaluate(() => {
    const api = window.__minecrack;
    api.start("creative");
    api.game.pause("inventory");
  });
  await expect(
    page.getByRole("dialog", { name: "Dans vos poches.", exact: true }),
  ).toBeVisible();
  const data = await page.evaluate(async () => {
    const ids = [
      "chocolatine",
      "cuir",
      "poche",
      "impots",
      "journal",
      "urssaf",
      "nucleaire",
      "b2",
      "socialiste",
      "cb12",
      "zerator",
      "gnome",
      "megaphone",
      "tgv",
      "furry",
      "radio",
    ];
    const result = [];
    for (const id of ids) {
      const image = new Image();
      image.src = `/assets/items/${id}.png`;
      await image.decode();
      result.push([image.naturalWidth, image.naturalHeight]);
    }
    return result;
  });
  expect(data).toHaveLength(16);
  expect(data.every((d) => d[0] === 512 && d[1] === 512)).toBe(true);
  expect(failures).toEqual([]);
  const terrain = await page.evaluate(() =>
    Object.values(window.__minecrack.game.world.materials)
      .flat()
      .map((m) => [m.map?.image?.width, m.map?.image?.height]),
  );
  expect(terrain.length).toBeGreaterThan(20);
  expect(terrain.every((d) => d[0] === 512 && d[1] === 512)).toBe(true);
});

test('full costume, third-person view, pause and responsive menu remain usable',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:1672,height:941});await page.goto('/?qa=1');await page.waitForFunction(()=>!!window.__minecrack);
  const out=process.env.MINECRACK_ARTIFACT_DIR;
  if(out){await fs.mkdir(out,{recursive:true});await page.screenshot({path:path.join(out,'minecrack-menu.png')});}
  await page.getByRole('button',{name:/Atelier créatif/}).click();await page.waitForFunction(()=>!window.__minecrack.game.paused);
  await page.evaluate(()=>window.__minecrack.use('furry'));await page.keyboard.press('F5');
  await page.waitForFunction(()=>window.__minecrack.game.thirdPerson&&window.__minecrack.game.avatar.visible);
  expect(await page.evaluate(()=>window.__minecrack.game.avatar.name)).toBe('player-furry-costume');
  if(out)await page.screenshot({path:path.join(out,'minecrack-costume.png')});
  await page.keyboard.press('F5');await page.keyboard.press('F5');await page.waitForFunction(()=>!window.__minecrack.game.thirdPerson);
  await page.getByText('Costume équipé : saut augmenté et dégâts réduits de 28 %.').waitFor({state:'hidden',timeout:15000});
  if(out)await page.screenshot({path:path.join(out,'minecrack-gameplay.png')});
  await page.keyboard.press('e');await expect(page.getByRole('dialog',{name:'Dans vos poches.'})).toBeVisible();
  if(out)await page.screenshot({path:path.join(out,'minecrack-inventory.png')});
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>{window.__minecrack.game.started=false;window.__minecrack.game.pause('menu');});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await expect(page.getByRole('button',{name:/Atelier créatif/})).toBeVisible();
  if(out)await page.screenshot({path:path.join(out,'minecrack-mobile-menu.png')});
  expect(errors).toEqual([]);
});
