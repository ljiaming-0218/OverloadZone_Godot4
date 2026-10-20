extends Control
## Screen-space HUD. Kept separate from the world canvas for camera stability.
var game

func _process(_delta:float) -> void:
	queue_redraw()

func _draw() -> void:
	if game == null:
		return
	var font:Font=game.ui_font
	var hp:float=game.player_hp/game.max_hp
	var charge:float=game.energy/100.0
	var ex:float=float(game.xp)/float(game.xp_needed)
	# Header: compact but strong readability in busy late-game waves.
	draw_rect(Rect2(18,16,360,133),Color(0.025,0.06,0.105,0.88))
	draw_rect(Rect2(18,16,360,133),Color("225771"),false,2.0)
	_label(font,Vector2(35,43),"OVERLOAD ZONE",22,Color("9fefff"))
	_label(font,Vector2(35,75),"生命",18,Color("bed6e3"))
	_bar(Rect2(110,61,244,15),hp,Color("f16b87"))
	_label(font,Vector2(35,105),"过载",18,Color("bed6e3"))
	_bar(Rect2(110,91,244,17),charge,Color("51f3d2") if charge<0.999 else Color("e8ff85"))
	_label(font,Vector2(115,134),"HP  %d / %d" % [roundi(game.player_hp),roundi(game.max_hp)],14,Color("c4d9e3"))
	_label(font,Vector2(272,134),"%d%%" % roundi(game.energy),16,Color("a7ffe1"))
	# Session timer, score and level.
	draw_rect(Rect2(424,14,430,70),Color(0.025,0.06,0.105,0.85))
	_label(font,Vector2(446,44),"试炼 %02d:%02d" % [int(game.time_alive)/60,int(game.time_alive)%60],23,Color("f4fbff"))
	_label(font,Vector2(646,44),"击杀 %d" % game.kills,23,Color("ffe3a4"))
	_label(font,Vector2(446,70),"等级 %d" % game.level,17,Color("c8d9e9"))
	_bar(Rect2(541,58,280,9),ex,Color("b18cff"))
	if game.boss_alive:
		_label(font,Vector2(914,45),"⚠  核心已经出现",21,Color("ffba94"))
	else:
		var wait:float=maxf(0.0,120.0-game.time_alive)
		_label(font,Vector2(914,45),"重装核心  %02d:%02d" % [int(wait)/60,int(wait)%60],19,Color("bfd6e7"))
	# Bottom action cards.
	draw_rect(Rect2(18,635,366,69),Color(0.025,0.06,0.105,0.85))
	_label(font,Vector2(34,662),"SPACE  冲刺 / 吸收敌弹",20,Color("d9f4ff"))
	_label(font,Vector2(34,690),"冷却 %.1fs" % game.dash_cd if game.dash_cd>0.0 else "冲刺就绪",17,Color("8bebd6"))
	draw_rect(Rect2(407,635,367,69),Color(0.025,0.06,0.105,0.85))
	_label(font,Vector2(425,662),"Q  过载爆发",21,Color("eeefff"))
	_label(font,Vector2(425,690),"能量已满 · 按 Q 清屏！" if game.energy>=99.9 else "吸收敌弹积攒过载能量",17,Color("eaff91") if game.energy>=99.9 else Color("96bed2"))
	if game.wave_notice>0.0:
		var fade:float=minf(1.0,game.wave_notice/0.3)
		var col:Color=Color("d4faff")
		col.a=fade
		_label(font,Vector2(640,171),game.notice_text,29,col,HORIZONTAL_ALIGNMENT_CENTER)
	if game.flash>0.0:
		draw_rect(Rect2(0,0,1280,720),Color(0.95,0.21,0.28,game.flash*0.13))

func _label(font:Font,p:Vector2,message:String,size:int,color:Color,align:HorizontalAlignment=HORIZONTAL_ALIGNMENT_LEFT) -> void:
	draw_string(font,p,message,align,-1,size,color)

func _bar(rect:Rect2,fill:float,color:Color) -> void:
	draw_rect(rect,Color("19283b"))
	draw_rect(Rect2(rect.position,Vector2(rect.size.x*clampf(fill,0.0,1.0),rect.size.y)),color)
	draw_rect(rect,Color("4c6878"),false,1.0)
