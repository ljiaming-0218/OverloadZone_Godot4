extends Node2D
## OVERLOAD ZONE — playable, asset-free roguelite vertical slice for Godot 4.3+
## Core loop: shoot -> dash THROUGH hostile bullets -> bank charge -> Q to erase a swarm.

const ARENA := Rect2(-1500.0, -1100.0, 3000.0, 2200.0)
const MAX_ENEMIES := 150
const MAX_FX := 700
const TRIAL_SECONDS := 180.0
const UPGRADES := [
	{"id":"rapid", "name":"超频扳机", "desc":"射速 +25%，子弹更密集", "tag":"火力"},
	{"id":"multi", "name":"双生弹幕", "desc":"额外发射 1 枚散射弹", "tag":"火力"},
	{"id":"damage", "name":"钨芯弹头", "desc":"所有枪击伤害 +30%", "tag":"火力"},
	{"id":"pierce", "name":"穿甲弹", "desc":"子弹穿透目标 +1", "tag":"火力"},
	{"id":"chain", "name":"死亡电弧", "desc":"击杀时闪电弹射附近敌人", "tag":"连锁"},
	{"id":"bomb", "name":"死亡爆破", "desc":"敌人死亡时产生范围爆炸", "tag":"连锁"},
	{"id":"recycler", "name":"能量回收", "desc":"每次吸收子弹的能量 +40%", "tag":"过载"},
	{"id":"blast", "name":"过载增幅", "desc":"过载爆炸范围 +30%，伤害 +20%", "tag":"过载"},
	{"id":"capacitor", "name":"击杀充能", "desc":"击杀敌人时回复额外过载能量", "tag":"过载"},
	{"id":"dash", "name":"瞬移核心", "desc":"冲刺冷却 -18%，冲刺距离 +12%", "tag":"机动"},
	{"id":"magnet", "name":"拾荒磁场", "desc":"经验吸附距离大幅增加", "tag":"生存"},
	{"id":"armor", "name":"纳米装甲", "desc":"生命上限 +20，立刻回复 20", "tag":"生存"},
	{"id":"orbit", "name":"电刃环绕", "desc":"获得持续环绕身体的能量刀刃", "tag":"连锁"},
	{"id":"vamp", "name":"猎杀修复", "desc":"每击杀 15 个敌人恢复 8 点生命", "tag":"生存"}
]

var rng := RandomNumberGenerator.new()
var camera: Camera2D
var ui_layer: CanvasLayer
var hud: Control
var ui_font: SystemFont
var overlay: Control

var player_pos := Vector2.ZERO
var player_hp := 100.0
var max_hp := 100.0
var invuln := 0.0
var aim_dir := Vector2.RIGHT
var move_dir := Vector2.ZERO
var energy := 50.0
var dash_cd := 0.0
var dash_timer := 0.0
var dash_dir := Vector2.RIGHT
var dash_trail := 0.0
var shot_cd := 0.0
var orbit_tick := 0.0
var time_alive := 0.0
var spawn_cd := 0.8
var wave_notice := 0.0
var notice_text := ""
var shake := 0.0
var flash := 0.0
var hit_stop := 0.0
var kills := 0
var level := 1
var xp := 0
var xp_needed := 6
var boss_spawned := false
var boss_alive := false
var won := false
var ended := false
var enemy_serial := 0
var chain_budget := 14
var selected_upgrades: Array[Dictionary] = []
var upgrades := {
	"rapid":0,"multi":0,"damage":0,"pierce":0,"chain":0,"bomb":0,
	"recycler":0,"blast":0,"capacitor":0,"dash":0,"magnet":0,
	"armor":0,"orbit":0,"vamp":0
}

var enemies: Array[Dictionary] = []
var friendly: Array[Dictionary] = []
var hostile: Array[Dictionary] = []
var gems: Array[Dictionary] = []
var particles: Array[Dictionary] = []
var texts: Array[Dictionary] = []
var rings: Array[Dictionary] = []
var beams: Array[Dictionary] = []
var samples := {}
var speakers: Array[AudioStreamPlayer] = []
var speaker_idx := 0

func _ready() -> void:
	rng.randomize()
	camera = $Camera2D
	ui_layer = $UI
	ui_layer.process_mode = Node.PROCESS_MODE_ALWAYS
	ui_font = SystemFont.new()
	ui_font.font_names = PackedStringArray(["Microsoft YaHei", "微软雅黑", "Noto Sans CJK SC", "SimHei", "Arial"])
	camera.global_position = player_pos
	_create_audio()
	_create_hud()
	_show_start()

func _process(delta: float) -> void:
	if ended:
		return
	if hit_stop > 0.0:
		hit_stop -= delta
		queue_redraw()
		return
	var dt: float = minf(delta, 0.045)
	time_alive += dt
	chain_budget = 14
	invuln = maxf(0.0, invuln - dt)
	dash_cd = maxf(0.0, dash_cd - dt)
	dash_timer = maxf(0.0, dash_timer - dt)
	shot_cd -= dt
	spawn_cd -= dt
	orbit_tick -= dt
	shake = maxf(0.0, shake - 22.0 * dt)
	flash = maxf(0.0, flash - 3.0 * dt)
	wave_notice = maxf(0.0, wave_notice - dt)
	_update_player(dt)
	_update_spawns(dt)
	_update_enemies(dt)
	_update_projectiles(dt)
	_update_gems(dt)
	_update_fx(dt)
	_cleanup_enemies()
	if time_alive >= TRIAL_SECONDS and boss_alive:
		_lose()
	camera.global_position = player_pos
	camera.offset = Vector2(rng.randf_range(-shake,shake), rng.randf_range(-shake,shake))
	queue_redraw()

func _update_player(dt: float) -> void:
	move_dir = Vector2(
		float(Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT)) - float(Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT)),
		float(Input.is_key_pressed(KEY_S) or Input.is_key_pressed(KEY_DOWN)) - float(Input.is_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP))
	).normalized()
	# The auto-targeting gun makes this accessible without any mouse input.
	var closest := INF
	var target_pos := player_pos + aim_dir * 100.0
	for e in enemies:
		if not e["alive"]:
			continue
		var ds: float = player_pos.distance_squared_to(e["p"])
		if ds < closest:
			closest = ds
			target_pos = e["p"]
	if closest < INF:
		aim_dir = (target_pos - player_pos).normalized()
	if Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT):
		var manual: Vector2 = get_global_mouse_position() - player_pos
		if manual.length_squared() > 40.0:
			aim_dir = manual.normalized()
	if Input.is_key_pressed(KEY_SPACE) and dash_cd <= 0.0 and dash_timer <= 0.0:
		_start_dash()
	if Input.is_key_pressed(KEY_Q) and energy >= 99.9:
		_release_overload()
	if dash_timer > 0.0:
		player_pos += dash_dir * (790.0 * (1.0 + upgrades["dash"] * 0.12)) * dt
		dash_trail -= dt
		if dash_trail <= 0.0:
			dash_trail = 0.023
			_emit_spark(player_pos, Color("4ee7ff"), 3, 125.0)
		# Dash is explicitly a BULLET ABSORBER, not ordinary invulnerability.
		for b in hostile:
			if b["alive"] and player_pos.distance_squared_to(b["p"]) < 76.0 * 76.0:
				_absorb(b)
	else:
		player_pos += move_dir * 285.0 * dt
	player_pos.x = clampf(player_pos.x, ARENA.position.x + 26.0, ARENA.end.x - 26.0)
	player_pos.y = clampf(player_pos.y, ARENA.position.y + 26.0, ARENA.end.y - 26.0)
	if shot_cd <= 0.0 and closest < 950.0 * 950.0:
		_shoot()
		shot_cd = 0.24 / (1.0 + upgrades["rapid"] * 0.25)
	if upgrades["orbit"] > 0 and orbit_tick <= 0.0:
		orbit_tick = 0.14
		for e in enemies:
			if not e["alive"]:
				continue
			for j in range(upgrades["orbit"] + 1):
				var a: float = time_alive * 3.2 + TAU * float(j) / float(upgrades["orbit"] + 1)
				var p: Vector2 = player_pos + Vector2.from_angle(a) * 74.0
				if e["p"].distance_squared_to(p) < (e["r"] + 14.0) ** 2:
					_damage_enemy(e, 13.0, p)

func _start_dash() -> void:
	dash_dir = move_dir if move_dir != Vector2.ZERO else aim_dir
	dash_timer = 0.18
	dash_cd = 1.45 * pow(0.82, upgrades["dash"])
	invuln = maxf(invuln, 0.2)
	shake = maxf(shake, 3.0)
	_emit_spark(player_pos, Color("65eaff"), 15, 220.0)
	_play_sound("dash")

func _absorb(b: Dictionary) -> void:
	b["alive"] = false
	energy = minf(100.0, energy + 8.0 * (1.0 + 0.4 * upgrades["recycler"]))
	_emit_spark(b["p"], Color("66fcff"), 8, 150.0)
	_rings(b["p"], 8.0, 35.0, Color("70dfff"), 0.18)
	_play_sound("collect")
	if energy >= 99.9:
		_notice("过载就绪！按 Q 引爆敌群", 2.1)

func _shoot() -> void:
	var count: int = 1 + upgrades["multi"]
	for i in range(count):
		var scatter: float = (float(i) - (float(count) - 1.0) / 2.0) * 0.15
		var d: Vector2 = aim_dir.rotated(scatter + rng.randf_range(-0.025, 0.025))
		friendly.append({"p":player_pos + d * 25.0, "v":d * 980.0, "ttl":1.1, "dmg":24.0 * (1.0 + 0.3 * upgrades["damage"]), "pierce":upgrades["pierce"],"hits":[]})
	_emit_spark(player_pos + aim_dir * 30.0, Color("ffe59b"), 2, 45.0)
	_play_sound("shoot")

func _release_overload() -> void:
	energy = 0.0
	var radius: float = 290.0 * (1.0 + 0.3 * upgrades["blast"])
	var damage: float = 105.0 * (1.0 + 0.2 * upgrades["blast"])
	shake = 15.0
	flash = 0.68
	hit_stop = 0.055
	_rings(player_pos, 34.0, radius, Color("76edff"), 0.58)
	_rings(player_pos, 20.0, radius * 0.78, Color("b8abff"), 0.46)
	_emit_spark(player_pos, Color("82efff"), 75, 540.0)
	for e in enemies:
		if e["alive"] and player_pos.distance_squared_to(e["p"]) <= (radius + e["r"]) ** 2:
			_damage_enemy(e, damage, player_pos)
	for b in hostile:
		if b["alive"] and player_pos.distance_squared_to(b["p"]) < (radius * 1.25) ** 2:
			b["alive"] = false
	_play_sound("overload")
	_notice("过 载 释 放 ！", 1.5)

func _update_spawns(_dt: float) -> void:
	if not boss_spawned and time_alive >= 120.0:
		boss_spawned = true
		boss_alive = true
		_spawn_enemy("boss", player_pos + Vector2(0.0,-510.0))
		_notice("⚠  重 装 核 心  已 入 侵", 3.4)
		_play_sound("level")
	if spawn_cd > 0.0:
		return
	var ramp: float = clampf(time_alive / 120.0, 0.0, 1.0)
	spawn_cd = lerpf(0.64, 0.22, ramp) * rng.randf_range(0.82, 1.15)
	if int(time_alive) % 30 == 0 and wave_notice <= 0.0 and time_alive > 5.0:
		_notice("⚡ 敌 群 猛 攻", 1.0)
	if enemies.size() >= MAX_ENEMIES:
		return
	var count := 1
	if time_alive > 45.0 and rng.randf() < 0.34:
		count = 2
	if time_alive > 95.0 and rng.randf() < 0.30:
		count = 3
	for i in range(count):
		var a: float = rng.randf_range(-PI, PI)
		var p: Vector2 = player_pos + Vector2.from_angle(a) * rng.randf_range(690.0, 810.0)
		p.x = clampf(p.x, ARENA.position.x + 40.0, ARENA.end.x - 40.0)
		p.y = clampf(p.y, ARENA.position.y + 40.0, ARENA.end.y - 40.0)
		var roll: float = rng.randf()
		var kind := "runner"
		if time_alive > 16.0 and roll < 0.28:
			kind = "shooter"
		elif time_alive > 36.0 and roll < 0.42:
			kind = "brute"
		_spawn_enemy(kind,p)

func _spawn_enemy(kind: String, p: Vector2) -> void:
	enemy_serial += 1
	var hp := 40.0
	var speed := 94.0
	var radius := 17.0
	if kind == "runner":
		hp = 32.0
		speed = 130.0 + time_alive * 0.09
	elif kind == "shooter":
		hp = 52.0
		speed = 72.0
		radius = 20.0
	elif kind == "brute":
		hp = 140.0
		speed = 56.0
		radius = 31.0
	elif kind == "boss":
		hp = 1250.0
		speed = 43.0
		radius = 76.0
	enemies.append({"id":enemy_serial,"kind":kind,"p":p,"hp":hp,"max_hp":hp,"speed":speed,"r":radius,"alive":true,
		"fire_cd":rng.randf_range(0.4, 1.4),"hurt":0.0,"phase":rng.randf_range(0.0, TAU)})

func _update_enemies(dt: float) -> void:
	for e in enemies:
		if not e["alive"]:
			continue
		e["hurt"] = maxf(0.0, e["hurt"] - dt)
		e["phase"] += dt * 2.0
		var to_player: Vector2 = player_pos - e["p"]
		var distance: float = to_player.length()
		var direction: Vector2 = to_player / maxf(distance, 0.01)
		var speed_scale := 1.0
		if e["kind"] == "shooter" and distance < 330.0:
			speed_scale = -0.34
		if e["kind"] == "boss" and distance < 230.0:
			speed_scale = -0.16
		e["p"] += direction * e["speed"] * dt * speed_scale
		e["fire_cd"] -= dt
		if e["fire_cd"] <= 0.0 and distance < 700.0:
			if e["kind"] == "shooter":
				_fire_hostile(e["p"], direction, 230.0, 10.0)
				e["fire_cd"] = rng.randf_range(1.5, 2.2)
			elif e["kind"] == "boss":
				for j in range(14):
					var a: float = TAU * float(j) / 14.0 + time_alive * 0.33
					_fire_hostile(e["p"], Vector2.from_angle(a), 200.0, 12.0)
				for j in range(-2,3):
					_fire_hostile(e["p"], direction.rotated(float(j) * 0.14), 290.0, 13.0)
				e["fire_cd"] = 3.0
		if distance < e["r"] + 18.0 and dash_timer <= 0.0 and invuln <= 0.0:
			_hurt_player(17.0 if e["kind"] == "boss" else 10.0)

func _fire_hostile(p: Vector2, d: Vector2, speed: float, damage: float) -> void:
	if hostile.size() >= 500:
		return
	hostile.append({"p":p + d * 23.0,"v":d * speed,"ttl":5.4,"r":9.0 if damage > 12.0 else 7.0,"dmg":damage,"alive":true})

func _update_projectiles(dt: float) -> void:
	for i in range(friendly.size()-1,-1,-1):
		var b: Dictionary = friendly[i]
		b["p"] += b["v"] * dt
		b["ttl"] -= dt
		var remove := b["ttl"] <= 0.0
		if not remove:
			for e in enemies:
				if not e["alive"] or b["hits"].has(e["id"]):
					continue
				if b["p"].distance_squared_to(e["p"]) < (e["r"] + 5.0) ** 2:
					b["hits"].append(e["id"])
					_damage_enemy(e, b["dmg"],b["p"])
					_emit_spark(b["p"], Color("ffbe78"), 4, 155.0)
					b["pierce"] -= 1
					if b["pierce"] < 0:
						remove = true
						break
		if remove:
			friendly.remove_at(i)
	for i in range(hostile.size()-1,-1,-1):
		var b: Dictionary = hostile[i]
		if not b["alive"]:
			hostile.remove_at(i)
			continue
		b["p"] += b["v"] * dt
		b["ttl"] -= dt
		if b["ttl"] <= 0.0:
			hostile.remove_at(i)
			continue
		if dash_timer > 0.0 and player_pos.distance_squared_to(b["p"]) < 78.0 ** 2:
			_absorb(b)
		elif player_pos.distance_squared_to(b["p"]) < (b["r"] + 16.0) ** 2 and invuln <= 0.0:
			b["alive"] = false
			_hurt_player(b["dmg"])
		if not b["alive"]:
			hostile.remove_at(i)

func _damage_enemy(e: Dictionary, damage: float, impact: Vector2) -> void:
	if not e["alive"]:
		return
	e["hp"] -= damage
	e["hurt"] = 0.13
	if damage > 25.0 and rng.randf() < 0.3:
		_text_pop(e["p"] + Vector2(0,-20),str(roundi(damage)), Color("ffdc93"))
	if e["hp"] <= 0.0:
		e["alive"] = false
		_on_enemy_killed(e)
	else:
		if e["kind"] == "boss" and damage > 60.0:
			shake = maxf(shake, 4.0)

func _on_enemy_killed(e: Dictionary) -> void:
	kills += 1
	var p: Vector2 = e["p"]
	var is_boss: bool = e["kind"] == "boss"
	_emit_spark(p, Color("ffbc6b") if not is_boss else Color("c397ff"), 14 if not is_boss else 120, 280.0)
	_rings(p, 8.0, 37.0 if not is_boss else 190.0, Color("fb6f80"), 0.25 if not is_boss else 0.9)
	if is_boss:
		boss_alive = false
		_play_sound("overload")
		_win()
		return
	if gems.size() < 250:
		gems.append({"p":p, "value": 3 if e["kind"] == "brute" else 2 if e["kind"] == "shooter" else 1, "spin":rng.randf_range(0.0, TAU)})
	if upgrades["capacitor"] > 0:
		energy = minf(100.0,energy + 1.8 * upgrades["capacitor"])
	if upgrades["vamp"] > 0 and kills % 15 == 0:
		player_hp = minf(max_hp, player_hp + 8.0)
		_text_pop(player_pos + Vector2(0,-35), "+8 HP",Color("9cffbd"))
	if upgrades["bomb"] > 0 and chain_budget > 0:
		chain_budget -= 1
		var radius: float = 75.0 + 23.0 * upgrades["bomb"]
		_rings(p, 8.0, radius, Color("ffad6e"),0.30)
		for other in enemies:
			if other["alive"] and other["p"].distance_squared_to(p) < (radius + other["r"]) ** 2:
				_damage_enemy(other,18.0 + 14.0 * upgrades["bomb"],p)
	if upgrades["chain"] > 0 and chain_budget > 0:
		chain_budget -= 1
		var candidates: Array[Dictionary] = []
		for other in enemies:
			if other["alive"] and other["p"].distance_squared_to(p) < 220.0 ** 2:
				candidates.append(other)
		candidates.sort_custom(func(a:Dictionary,b:Dictionary) -> bool:
			return a["p"].distance_squared_to(p) < b["p"].distance_squared_to(p)
		)
		for j in range(mini(candidates.size(), 1 + upgrades["chain"])):
			var other: Dictionary = candidates[j]
			beams.append({"a":p,"b":other["p"],"t":0.13,"life":0.13})
			_damage_enemy(other,19.0 + 12.0 * upgrades["chain"],p)
	if rng.randf() < 0.22:
		_play_sound("hit")

func _hurt_player(amount: float) -> void:
	if invuln > 0.0 or ended:
		return
	player_hp -= amount
	invuln = 0.85
	shake = maxf(shake, 9.0)
	flash = maxf(flash, 0.24)
	_text_pop(player_pos+Vector2(0,-36), "-%d" % roundi(amount),Color("ff657c"))
	_emit_spark(player_pos,Color("ff7783"),10,210.0)
	_play_sound("hurt")
	if player_hp <= 0.0:
		player_hp = 0.0
		_lose()

func _update_gems(dt: float) -> void:
	for i in range(gems.size()-1,-1,-1):
		var gem: Dictionary = gems[i]
		gem["spin"] += 3.0 * dt
		var to: Vector2 = player_pos - gem["p"]
		var d: float = to.length()
		var magnet_radius: float = 140.0 + upgrades["magnet"] * 110.0
		if d < magnet_radius and d > 0.01:
			gem["p"] += to / d * (340.0 + magnet_radius - d) * dt
		if d <= 25.0:
			xp += gem["value"]
			gems.remove_at(i)
			if rng.randf() < 0.23:
				_play_sound("collect")
			if xp >= xp_needed:
				_check_levelup()

func _check_levelup() -> void:
	if xp < xp_needed or ended or overlay != null:
		return
	xp -= xp_needed
	level += 1
	xp_needed = 6 + level * 4
	player_hp = minf(max_hp,player_hp + 4.0)
	_show_upgrades()

func _cleanup_enemies() -> void:
	for i in range(enemies.size()-1,-1,-1):
		if not enemies[i]["alive"]:
			enemies.remove_at(i)

func _update_fx(dt: float) -> void:
	for i in range(particles.size()-1,-1,-1):
		var p: Dictionary = particles[i]
		p["t"] -= dt
		p["p"] += p["v"] * dt
		p["v"] *= maxf(0.0,1.0 - 3.4 * dt)
		if p["t"] <= 0.0:
			particles.remove_at(i)
	for i in range(texts.size()-1,-1,-1):
		texts[i]["t"] -= dt
		var pos:Vector2 = texts[i]["p"]
		pos.y -= 36.0 * dt
		texts[i]["p"] = pos
		if texts[i]["t"] <= 0.0:
			texts.remove_at(i)
	for i in range(rings.size()-1,-1,-1):
		rings[i]["t"] -= dt
		if rings[i]["t"] <= 0.0:
			rings.remove_at(i)
	for i in range(beams.size()-1,-1,-1):
		beams[i]["t"] -= dt
		if beams[i]["t"] <= 0.0:
			beams.remove_at(i)

func _emit_spark(p:Vector2, c:Color, amount:int, speed:float) -> void:
	for j in range(amount):
		if particles.size() >= MAX_FX:
			return
		var angle:float = rng.randf_range(0.0,TAU)
		var v:Vector2 = Vector2.from_angle(angle) * rng.randf_range(speed*0.28,speed)
		var lifetime:float = rng.randf_range(0.18,0.56)
		particles.append({"p":p,"v":v,"t":lifetime,"life":lifetime,"c":c,"r":rng.randf_range(2.0,5.0)})

func _rings(p:Vector2, r0:float, r1:float, c:Color, duration:float) -> void:
	rings.append({"p":p,"r0":r0,"r1":r1,"t":duration,"life":duration,"c":c})

func _text_pop(p:Vector2, value:String, c:Color) -> void:
	if texts.size() > 60:
		return
	texts.append({"p":p,"value":value,"t":0.65,"life":0.65,"c":c})

func _notice(value:String, duration:float) -> void:
	notice_text = value
	wave_notice = duration

func _win() -> void:
	if ended:
		return
	ended = true
	won = true
	_show_end(true)

func _lose() -> void:
	if ended:
		return
	ended = true
	won = false
	_show_end(false)

func _draw() -> void:
	# The entire game is procedurally drawn. No external textures or sprite downloads.
	draw_rect(ARENA,Color("0b1427"))
	var grid:float = 100.0
	for i in range(-15,16):
		var x:float = float(i)*grid
		draw_line(Vector2(x,ARENA.position.y),Vector2(x,ARENA.end.y),Color(0.17,0.29,0.41,0.30),1.0)
	for i in range(-11,12):
		var y:float = float(i)*grid
		draw_line(Vector2(ARENA.position.x,y),Vector2(ARENA.end.x,y),Color(0.17,0.29,0.41,0.30),1.0)
	for i in range(-5,6):
		for j in range(-4,5):
			var center:Vector2 = Vector2(float(i)*300.0,float(j)*270.0)
			draw_arc(center,32.0,0.0,TAU,24,Color(0.13,0.43,0.54,0.16),1.5)
			draw_circle(center,2.0,Color(0.22,0.68,0.75,0.24))
	draw_rect(ARENA,Color("309db3"),false,5.0)
	for g in gems:
		var p:Vector2 = g["p"]
		var s:float = 9.0 + sin(g["spin"])*1.7
		draw_circle(p,15.0,Color(0.24,0.9,0.8,0.12))
		draw_colored_polygon(PackedVector2Array([p+Vector2(0,-s),p+Vector2(s*0.75,0),p+Vector2(0,s),p+Vector2(-s*0.75,0)]),Color("79ffd1") if g["value"]==1 else Color("c4a5ff"))
	for e in enemies:
		if e["alive"]:
			_draw_enemy(e)
	for b in friendly:
		var d:Vector2 = b["v"].normalized()
		draw_line(b["p"] - d*19.0,b["p"]+d*8.0,Color("ffe9a5"),5.0,true)
		draw_circle(b["p"],4.5,Color.WHITE)
	for b in hostile:
		if not b["alive"]:
			continue
		draw_circle(b["p"],b["r"]*2.1,Color(1.0,0.30,0.21,0.12))
		draw_circle(b["p"],b["r"],Color("ff826c"))
		draw_circle(b["p"],b["r"]*0.44,Color("fff0be"))
	_draw_player()
	for j in range(upgrades["orbit"] + 1 if upgrades["orbit"]>0 else 0):
		var a:float = time_alive*3.2 + TAU*float(j)/float(upgrades["orbit"]+1)
		var p:Vector2 = player_pos+Vector2.from_angle(a)*74.0
		draw_circle(p,20.0,Color(0.34,0.85,1.0,0.15))
		draw_colored_polygon(PackedVector2Array([p+Vector2(0,-20),p+Vector2(11,0),p+Vector2(0,20),p+Vector2(-11,0)]),Color("7ad8ff"))
	for ring in rings:
		var phase:float = 1.0-ring["t"]/ring["life"]
		var radius:float = lerpf(ring["r0"],ring["r1"],phase)
		var col:Color = ring["c"]
		col.a = (1.0-phase)*0.88
		draw_arc(ring["p"],radius,0.0,TAU,72,col,5.0,true)
	for beam in beams:
		var alpha:float = beam["t"]/beam["life"]
		draw_line(beam["a"],beam["b"],Color(0.43,0.85,1.0,alpha*0.45),10.0,true)
		draw_line(beam["a"],beam["b"],Color(0.90,1.0,1.0,alpha),3.0,true)
	for p in particles:
		var col:Color = p["c"]
		col.a = p["t"]/p["life"]
		draw_circle(p["p"],p["r"]*maxf(0.2,p["t"]/p["life"]),col)
	for t in texts:
		var col:Color = t["c"]
		col.a = t["t"]/t["life"]
		draw_string(ui_font,t["p"],t["value"],HORIZONTAL_ALIGNMENT_CENTER,-1,21,col)

func _draw_enemy(e:Dictionary) -> void:
	var p:Vector2 = e["p"]
	var r:float = e["r"]
	var color:Color = Color("fe5d7a")
	if e["kind"] == "shooter":
		color=Color("c58cff")
	if e["kind"] == "brute":
		color=Color("ffb45e")
	if e["kind"] == "boss":
		color=Color("ba73ff")
	if e["hurt"]>0.0:
		color=Color.WHITE
	draw_circle(p,r*1.5,Color(color.r,color.g,color.b,0.08))
	if e["kind"] == "runner":
		var dir:Vector2 = (player_pos-p).normalized()
		draw_colored_polygon(PackedVector2Array([p+dir*r*1.3,p+dir.rotated(2.35)*r,p+dir.rotated(-2.35)*r]),color)
	elif e["kind"] == "shooter":
		draw_colored_polygon(PackedVector2Array([p+Vector2(0,-r),p+Vector2(r,0),p+Vector2(0,r),p+Vector2(-r,0)]),color)
		draw_circle(p,6.0,Color("221c3c"))
	elif e["kind"] == "brute":
		draw_rect(Rect2(p-Vector2.ONE*r,Vector2.ONE*r*2.0),color)
		draw_rect(Rect2(p-Vector2.ONE*(r-7.0),Vector2.ONE*(r-7.0)*2.0),Color("5b3243"),false,3.0)
	else:
		draw_circle(p,r,color)
		draw_arc(p,r-14.0,e["phase"],e["phase"]+PI*1.4,32,Color("ffedaf"),7.0,true)
		draw_circle(p,27.0,Color("2c2047"))
		draw_circle(p,12.0,Color("faf0ff"))
	if e["kind"] != "runner":
		var width:float = r*2.3
		draw_rect(Rect2(p+Vector2(-width*0.5,-r-17.0),Vector2(width,5)),Color("19243a"))
		draw_rect(Rect2(p+Vector2(-width*0.5,-r-17.0),Vector2(width*clampf(e["hp"]/e["max_hp"],0,1),5)),Color("79fdcb") if e["kind"]=="boss" else color)

func _draw_player() -> void:
	var p:Vector2=player_pos
	var flashing:bool = invuln>0.0 and int(time_alive*16.0)%2==0
	var c:Color = Color("efffff") if flashing else Color("55d8ff")
	draw_circle(p,37.0,Color(0.15,0.78,1.0,0.14))
	if dash_timer>0.0:
		draw_arc(p,51.0,0.0,TAU,40,Color("97f7ff"),4.0)
	if energy>=99.9:
		draw_arc(p,40.0,-PI/2.0,-PI/2.0+TAU,44,Color(0.45,1.0,0.85,0.62+0.30*sin(time_alive*12.0)),3.0,true)
	var side:Vector2 = aim_dir.rotated(PI/2.0)
	draw_colored_polygon(PackedVector2Array([p+aim_dir*24.0,p-aim_dir*16.0+side*16.0,p-aim_dir*9.0,p-aim_dir*16.0-side*16.0]),c)
	draw_circle(p,10.0,Color("0c1930"))
	draw_circle(p,4.0,Color("e3ffff"))
	draw_line(p+aim_dir*12.0,p+aim_dir*34.0,Color("ffdf89"),8.0,true)

func _create_hud() -> void:
	hud = Control.new()
	hud.set_script(load("res://scripts/hud.gd"))
	hud.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	hud.mouse_filter = Control.MOUSE_FILTER_IGNORE
	ui_layer.add_child(hud)
	hud.set("game", self)

func _style_label(label:Label,size:int=22,color:Color=Color.WHITE) -> void:
	label.add_theme_font_override("font",ui_font)
	label.add_theme_font_size_override("font_size",size)
	label.add_theme_color_override("font_color",color)

func _style_button(button:Button,accent:Color) -> void:
	button.add_theme_font_override("font",ui_font)
	button.add_theme_font_size_override("font_size",21)
	button.custom_minimum_size=Vector2(560,70)
	var normal:=StyleBoxFlat.new()
	normal.bg_color=Color("1b3042")
	normal.border_color=accent
	normal.set_border_width_all(2)
	normal.set_corner_radius_all(12)
	button.add_theme_stylebox_override("normal",normal)
	var hover:=normal.duplicate() as StyleBoxFlat
	hover.bg_color=Color("28445b")
	button.add_theme_stylebox_override("hover",hover)
	var pressed:=normal.duplicate() as StyleBoxFlat
	pressed.bg_color=Color("426779")
	button.add_theme_stylebox_override("pressed",pressed)
	button.add_theme_color_override("font_color",Color("f2fbff"))
	button.add_theme_color_override("font_hover_color",Color("ffffff"))

func _overlay_frame(title:String,subtitle:String) -> VBoxContainer:
	if overlay != null:
		overlay.queue_free()
	overlay=Control.new()
	overlay.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	overlay.mouse_filter=Control.MOUSE_FILTER_STOP
	ui_layer.add_child(overlay)
	var scrim:=ColorRect.new()
	scrim.color=Color(0.016,0.033,0.066,0.93)
	scrim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	overlay.add_child(scrim)
	var centered:=CenterContainer.new()
	centered.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	overlay.add_child(centered)
	var panel:=PanelContainer.new()
	panel.custom_minimum_size=Vector2(660,0)
	var box:=StyleBoxFlat.new()
	box.bg_color=Color("0c1a2a")
	box.border_color=Color("3a97aa")
	box.set_border_width_all(2)
	box.set_corner_radius_all(20)
	box.content_margin_left=36
	box.content_margin_top=32
	box.content_margin_right=36
	box.content_margin_bottom=32
	panel.add_theme_stylebox_override("panel",box)
	centered.add_child(panel)
	var stack:=VBoxContainer.new()
	stack.add_theme_constant_override("separation",16)
	panel.add_child(stack)
	var headline:=Label.new()
	headline.text=title
	headline.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER
	_style_label(headline,39,Color("8debff"))
	stack.add_child(headline)
	var description:=Label.new()
	description.text=subtitle
	description.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER
	description.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART
	_style_label(description,19,Color("b4cbd8"))
	stack.add_child(description)
	return stack

func _show_start() -> void:
	get_tree().paused=true
	var stack:=_overlay_frame("过 载 禁 区", "OVERLOAD ZONE  /  3 分钟生存试炼")
	var summary:=Label.new()
	summary.text="WASD 移动   •   自动瞄准开火\nSPACE 冲刺吸收红色敌弹   •   Q 能量满时释放过载\n吃下绿色经验晶体升级，尝试凑出闪电 + 爆炸连锁。\n2:00 时强敌出现；击败核心即获胜。"
	summary.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER
	summary.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART
	_style_label(summary,19,Color("d6f8ed"))
	stack.add_child(summary)
	var button:=Button.new()
	button.text="▶  开始试炼"
	_style_button(button,Color("69eac6"))
	stack.add_child(button)
	button.pressed.connect(_start_game)

func _show_upgrades() -> void:
	get_tree().paused=true
	_play_sound("level")
	selected_upgrades.clear()
	var pool:Array = UPGRADES.duplicate(true)
	pool.shuffle()
	for i in range(3):
		selected_upgrades.append(pool[i])
	var stack:=_overlay_frame("升级！选择一项强化", "LV.%d    •    不同天赋可以叠加，形成连锁反应" % level)
	for i in range(selected_upgrades.size()):
		var d:Dictionary=selected_upgrades[i]
		var button:=Button.new()
		button.text="%d    [%s] %s\n      %s" % [i+1,d["tag"],d["name"],d["desc"]]
		_style_button(button,Color("85eaff") if i==0 else Color("c5a4ff") if i==1 else Color("ffcd82"))
		stack.add_child(button)
		button.pressed.connect(_choose_upgrade.bind(d["id"]))

func _choose_upgrade(id:String) -> void:
	upgrades[id]+=1
	if id=="armor":
		max_hp+=20.0
		player_hp=minf(max_hp,player_hp+20.0)
	_notice("已获得强化：%s" % _upgrade_name(id),1.9)
	_dismiss_overlay()
	get_tree().paused=false
	if xp>=xp_needed:
		_check_levelup()

func _upgrade_name(id:String) -> String:
	for d in UPGRADES:
		if d["id"]==id:
			return d["name"]
	return id

func _show_end(success:bool) -> void:
	get_tree().paused=true
	var title:String="试炼成功 · 核心已击破" if success else "试炼终止 · 信号丢失"
	var stack:=_overlay_frame(title, "存活 %02d:%02d   •   击杀 %d   •   等级 %d" % [int(time_alive)/60,int(time_alive)%60,kills,level])
	var desc:=Label.new()
	desc.text="最强的清屏，不是把怪物变少，而是让敌人的子弹成为你的武器。\n再试一次不同的技能组合？"
	desc.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER
	_style_label(desc,19,Color("d6f8ed"))
	stack.add_child(desc)
	var button:=Button.new()
	button.text="↻  再来一局"
	_style_button(button,Color("69eac6"))
	stack.add_child(button)
	button.pressed.connect(_restart_game)

func _dismiss_overlay() -> void:
	if overlay!=null:
		overlay.queue_free()
		overlay=null

func _create_audio() -> void:
	# Procedurally synthesized PCM SFX; offline, no asset downloads or permissions.
	for key in ["shoot","dash","collect","overload","hit","hurt","level"]:
		samples[key]=_synthesize(key)
	for i in range(10):
		var player:=AudioStreamPlayer.new()
		player.volume_db=-9.0
		add_child(player)
		speakers.append(player)

func _play_sound(name:String) -> void:
	if not samples.has(name):
		return
	var speaker:AudioStreamPlayer=speakers[speaker_idx]
	speaker_idx=(speaker_idx+1)%speakers.size()
	speaker.stop()
	speaker.stream=samples[name]
	speaker.pitch_scale=rng.randf_range(0.94,1.06)
	speaker.volume_db= -16.0 if name=="shoot" else -12.0 if name=="collect" else -7.0
	speaker.play()

func _synthesize(kind:String) -> AudioStreamWAV:
	var rate:=22050
	var duration:=0.10
	var start_freq:=700.0
	var end_freq:=240.0
	var noise:=0.12
	if kind=="dash":
		duration=0.22
		start_freq=950.0
		end_freq=120.0
		noise=0.30
	if kind=="collect":
		duration=0.13
		start_freq=510.0
		end_freq=1120.0
		noise=0.03
	if kind=="overload":
		duration=0.68
		start_freq=115.0
		end_freq=42.0
		noise=0.38
	if kind=="hit":
		duration=0.13
		start_freq=330.0
		end_freq=70.0
		noise=0.45
	if kind=="hurt":
		duration=0.35
		start_freq=220.0
		end_freq=66.0
		noise=0.33
	if kind=="level":
		duration=0.47
		start_freq=380.0
		end_freq=790.0
		noise=0.05
	var data:=PackedByteArray()
	var num:=int(rate*duration)
	data.resize(num*2)
	var phase:=0.0
	for i in range(num):
		var t:float=float(i)/float(num)
		var f:float=lerpf(start_freq,end_freq,t)
		phase += TAU*f/float(rate)
		var envelope:float=pow(1.0-t,1.8)*minf(1.0,t*60.0)
		var value:float=(sin(phase)*0.72+sin(phase*0.49)*0.21+rng.randf_range(-1.0,1.0)*noise)*envelope
		var sample:int=int(clampf(value,-1.0,1.0)*27000.0)
		if sample<0:
			sample+=65536
		data[i*2]=sample&255
		data[i*2+1]=(sample>>8)&255
	var wave:=AudioStreamWAV.new()
	wave.format=AudioStreamWAV.FORMAT_16_BITS
	wave.mix_rate=rate
	wave.stereo=false
	wave.data=data
	return wave

func _start_game() -> void:
	_dismiss_overlay()
	get_tree().paused=false

func _restart_game() -> void:
	get_tree().paused=false
	get_tree().reload_current_scene()