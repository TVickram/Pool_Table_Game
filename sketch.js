let Engine = Matter.Engine;
const Render = Matter.Render;
let World = Matter.World;
let Bodies = Matter.Bodies;
let Body = Matter.Body;
let Constraint = Matter.Constraint;
let Mouse = Matter.Mouse;
let Collision = Matter.Collision;
var MouseConstraint = Matter.MouseConstraint;
let Sleeping = Matter.Sleeping;
let engine = Engine.create();
let gameStart = false;
let canvas;
const tableWidth = 800;
const tableLength = tableWidth / 2;
const ballDiameter = tableLength / 36;
const ballRadius = ballDiameter / 2;

let table = new Table();
let cueStick = new CueStick();
let cue = new CueBall();
var ballManager = new BallManager();
var scoreBoard = new ScoreBoard();
var timer = new Timer();
var extensions = new Extensions();
var hp = new Helper();

function setup() {
  canvas = createCanvas(1300, 800);
  angleMode(DEGREES);
  background(0);
  table.createCushions();
  table.createHardBarriers();
  hp.setupMouseInteraction();
}

function draw() {
  background(200, 20, 200); // Set background color
  Engine.update(engine); // Update the physics engine
  engine.gravity.y = 0; // Disable gravity for the pool table

  // Check if the cue ball is moving
  if (cue.ball) {
    const velocityThreshold = 0.05; // Velocity below which the ball is considered "stopped"
    const isMoving =
      Math.abs(cue.ball.velocity.x) > velocityThreshold ||
      Math.abs(cue.ball.velocity.y) > velocityThreshold;

    // Toggle cue stick visibility based on cue ball's movement
    cueStick.visible = !isMoving;

    // Keep the cue ball within table boundaries
    const tableBounds = { xMin: 200, xMax: 1000, yMin: 100, yMax: 500 };
    if (
      cue.ball.position.x < tableBounds.xMin ||
      cue.ball.position.x > tableBounds.xMax ||
      cue.ball.position.y < tableBounds.yMin ||
      cue.ball.position.y > tableBounds.yMax
    ) {
      Body.setPosition(cue.ball, {
        x: constrain(cue.ball.position.x, tableBounds.xMin, tableBounds.xMax),
        y: constrain(cue.ball.position.y, tableBounds.yMin, tableBounds.yMax),
      });
      Body.setVelocity(cue.ball, { x: 0, y: 0 }); // Stop the ball when it hits the boundary
    }
  }

  // Draw the table and its elements
  table.draw();

  // Display the game title
  push();
  textSize(36);
  fill("white");
  stroke(255);
  text("Vickram's GP Midterms", 450, 50);
  pop();

  // Draw the timer
  timer.drawTimer();

  // If the game hasn't started, prompt to select a mode
  if (!ballManager.mode) {
    push();
    textSize(24);
    fill("white");
    text(
      'Select Mode with key: "1" for ordered, "4" for unordered',
      200,
      600
    );
    pop();
  } else {
    // Display game mode and scores
    textSize(14);
    text("mode: " + ballManager.mode, 25, 100);
    ballManager.drawBalls();
    scoreBoard.showScore();

    if (!gameStart) {
      // Prompt to place the white ball before the game starts
      textSize(24);
      stroke(255);
      text("Click anywhere on the D line to place the white ball", 200, 600);
    } else {
      // Start the timer and game
      timer.startTimer();
      push();
      textSize(24);
      fill("white");
      text('press key "r" to restart the game', 200, 600);
      text(
        'press key "2" to randomize red balls only and press key "3" to randomize all balls',
        200,
        650
      );
      pop();

      // Draw the cue ball
      if (cue.ball) {
        cue.draw();
      }

      // Draw target and fouls
      ballManager.showTarget();
      ballManager.drawFoul();

      // Collision detection and game logic
      if (cue.inField() && !cue.isConstrained) {
        table.detectCollision(cue.ball);
        ballManager.detectCollision(cue.ball);
        ballManager.detectFalling();
        ballManager.checkWin();

        if (cue.notMoving()) {
          ballManager.newTurn();
          extensions.deactivate();
        }
      } else if (!cue.isConstrained) {
        scoreBoard.addScore(-4);
        World.remove(engine.world, [cue.ball, cue.ballConstraint]);
        gameStart = false;
      }

      // Update and draw the cue stick if visible
      if (cueStick.visible && cue.ball) {
        cueStick.update(cue.ball);
        cueStick.draw();
      }
    }
  }
}




function keyPressed() {
  if (!gameStart && !ballManager.mode) {
    if (key.toLowerCase() === "4") {
      ballManager.setMode("unordered");
    }
    if (key.toLowerCase() === "1") {
      ballManager.setMode("ordered");
    }
  }

  if (key.toLowerCase() === "r") {
    window.location.reload();
  }
}

function mousePressed() {
  if (!gameStart && ballManager.mode) {
    // Allow placing the cue ball in the D zone
    if (
      dist(mouseX, mouseY, 350, 175 + 370 / 3) < 75 && // Ensure within D zone radius
      mouseX < 350 // Ensure left of the D line
    ) {
      gameStart = true;
      cue.setUpCueBall(mouseX, mouseY); // Place the cue ball
      ballManager.setBallsSleep(true);
      extensions.placeButtons();
    }
  } else if (
    gameStart &&
    cue.ball &&
    dist(mouseX, mouseY, cue.ball.position.x, cue.ball.position.y) < 150
  ) {
    // Handle dragging the cue stick
    cueStick.dragging = true;
  }
}


function mouseReleased() {
  // Check if the cue stick was dragging and the cue ball exists
  if (cueStick.dragging && cue.ball) {
    console.log("cueStick.hitBall invoked"); // Debugging log

    // Calculate and apply force to the cue ball
    const maxForceMultiplier = 10; // Maximum force applied
    const minForceMultiplier = 0.05;  // Minimum force for short hits
    const durationMultiplier = constrain(cueStick.mouseHoldTime / 30, 0.5, 2); // Force scales with mouse hold time
    const forceMultiplier = constrain(
      durationMultiplier * minForceMultiplier,
      minForceMultiplier,
      maxForceMultiplier
    );

    const forceVector = {
      x: cos(cueStick.angle) * forceMultiplier,
      y: sin(cueStick.angle) * forceMultiplier,
    };

    // Apply the calculated force to the cue ball
    Body.applyForce(cue.ball, cue.ball.position, forceVector);

    // Limit the ball's velocity to prevent excessive speed
    const velocityLimit = 15; // Reduced to slow the ball down
    Body.setVelocity(cue.ball, {
      x: constrain(cue.ball.velocity.x, -velocityLimit, velocityLimit),
      y: constrain(cue.ball.velocity.y, -velocityLimit, velocityLimit),
    });

    cueStick.dragging = false; // Stop dragging
    cueStick.mouseHoldTime = 0; // Reset hold time
  }

  if (gameStart) {
    //cue.removeConstraint(cue.ballConstraint);
    ballManager.setBallsSleep(false);
  }

  console.log("mouseReleased executed"); // Debugging log
}


// ----------------------- Function for cue stick -----------------------

function CueStick() {
  this.position = { x: 0, y: 0 };
  this.angle = 0;
  this.force = 0;
  this.dragging = false;
  this.stickDistance = 150; // Initial distance between the cue stick and cue ball
  this.maxStickDistance = 300; // Maximum distance when mouse is held
  this.mouseHoldTime = 0; // Time in frames for which the mouse is held
  this.visible = true; // Flag to track visibility of the cue stick

  // Updates the position and angle of the cue stick
  this.update = (cueBall) => {
    if (!this.visible) return; // Skip updating if cue stick is not visible

    const cuePos = cueBall.position;

    // Update the angle to point toward the mouse position
    this.angle = atan2(mouseY - cuePos.y, mouseX - cuePos.x);

    if (this.dragging) {
      // Gradually increase the stick distance and track hold time
      this.stickDistance = constrain(
        this.stickDistance + 2, // Adjust growth rate here
        150,
        this.maxStickDistance
      );
      this.mouseHoldTime += 1; // Increment hold time
    } else {
      // Reset the stick distance and hold time when not dragging
      this.stickDistance = 150;
      this.mouseHoldTime = 0;
    }

    // Calculate the cue stick position based on distance and angle
    this.position = {
      x: cuePos.x - cos(this.angle) * this.stickDistance,
      y: cuePos.y - sin(this.angle) * this.stickDistance,
    };
  };

  // Draw the cue stick
  this.draw = () => {
    if (!this.visible) return; // Skip drawing if cue stick is not visible

    push();
    strokeWeight(10);
    stroke(139, 69, 19); // Brown color for the cue stick
    line(
      this.position.x,
      this.position.y,
      this.position.x + cos(this.angle) * 150,
      this.position.y + sin(this.angle) * 150
    );
    pop();
  };

  // Apply the force to the cue ball
  this.hitBall = (cueBall) => {
    console.log("Applying force to the cue ball"); // Debugging statement
  
    const maxForceMultiplier = 15; // Lower maximum force to prevent excessive speed
    const minForceMultiplier = 2; // Ensure even short hits have some effect
    const durationMultiplier = constrain(this.mouseHoldTime / 30, 0.5, 2); // Scaled by hold time
    const forceMultiplier = constrain(
      durationMultiplier * minForceMultiplier,
      minForceMultiplier,
      maxForceMultiplier
    );
  
    const forceVector = {
      x: cos(this.angle) * forceMultiplier,
      y: sin(this.angle) * forceMultiplier,
    };
  
    Body.applyForce(cueBall, cueBall.position, forceVector);
  
    // Clamp velocity directly after applying force
    const velocityLimit = 10; // Reduce this to limit speed
    Body.setVelocity(cueBall, {
      x: constrain(cueBall.velocity.x, -velocityLimit, velocityLimit),
      y: constrain(cueBall.velocity.y, -velocityLimit, velocityLimit),
    });
  
    this.mouseHoldTime = 0; // Reset hold time after the hit
  };  
}



// ----------------------- Function for ball -----------------------
function Ball(x, y, color, value) {
  return {
    object: Bodies.circle(x, y, ballRadius, {
      isSleeping: true,
      collisionFilter: { category: 0x0002 },
      restitution: 0.9,
      friction: 0.7,
    }),
    color: color,
    value: value,
  };
}

  // ----------------------- Function to manage ball -----------------------
function BallManager() {
    this.balls = {
      red: [],
      color: [],
    };
    this.foul = false;
    let won = false;
    this.foulMessage = "";
    let consecColor = 0;
    let target = "Red Ball";
    this.redBallIn = false;
    let ballCollided;
    this.mode;
    this.coloredBalls = {
      pink: {
        x: 720,
        y: 310 - 800 / 72,
        value: 6,
      },
      blue: {
        x: 600,
        y: 310 - 800 / 72,
        value: 5,
      },
      black: {
        x: 900,
        y: 310 - 800 / 72,
        value: 7,
      },
      brown: {
        x: 360,
        y: 310 - 800 / 72,
        value: 4,
      },
      green: {
        x: 360,
        y: 250 + 370 / 3,
        value: 3,
      },
      yellow: {
        x: 360,
        y: 100 + 370 / 3,
        value: 2,
      },
    };
  
    this.setMode = (mode) => {
      this.mode = mode;
      createBalls(mode);
    };
  
    const createRedBalls = () => {
      let startingX = 725;
      let startingY = 305;
      const radius = ballRadius;
      let gap = 4;
      for (var i = 0; i < 6; i++) {
        let ypos = startingY - i * radius;
        for (var j = 0; j < i; j++) {
          createBall(
            startingX + i * (radius + gap),
            ypos + 2 * j * radius,
            "red",
            1
          );
        }
      }
    };
  
  
    const createBall = (x, y, color, value) => {
      let ball = new Ball(x, y, color, value);
      this.balls[color == "red" ? "red" : "color"].push(ball);
      World.add(engine.world, [ball.object]);
    };
  
    const createBalls = (mode) => {
      switch (mode) {
        case "ordered":
          createRedBalls();
          for (color in this.coloredBalls) {
            createBall(
              this.coloredBalls[color]["x"],
              this.coloredBalls[color]["y"],
              color,
              this.coloredBalls[color]["value"]
            );
          }
          break;
        case "unordered":
          for (let i = 0; i < 15; i++) {
            createBall(random(250, 950), random(150, 400), "red", 1);
            Sleeping.set(this.balls["red"][i]["object"], false);
          }
          for (var i = 0; i < Object.keys(this.coloredBalls).length; i++) {
            let color = Object.keys(this.coloredBalls)[i];
            createBall(
              random(250, 950),
              random(150, 400),
              color,
              this.coloredBalls[color]["value"]
            );
            Sleeping.set(this.balls["color"][i]["object"], false);
          }
          break;
      }
    };
  
    this.setBallsSleep = (asleep) => {
      for (type in this.balls) {
        for (ball of this.balls[type]) {
          Sleeping.set(ball.object, asleep);
        }
      }
    };
  
    this.drawBalls = () => {
      for (balltype in this.balls) {
        for (ball of this.balls[balltype]) {
          push();
          fill(ball.color);
          noStroke();
          hp.drawVertices(ball.object.vertices);
          pop();
        }
      }
    };
  
    this.detectFalling = () => {
      for (balltype in this.balls) {
        for (ball of this.balls[balltype]) {
          if (ball.object.position.y <= 106 || ball.object.position.y >= 494) {
            if (ball.color == "red") {
              this.redBallIn = true;
              removeBall(this.balls.red, this.balls.red.indexOf(ball));
              target = "Colored Ball";
            } else {
              removeBall(this.balls.color, this.balls.color.indexOf(ball));
              consecColor++;
              if (consecColor >= 2) {
                this.foul = true;
                this.foulMessage = "Two Consecutive Colored balls fell";
              }
              if (this.balls.red.length != 0) {
                createBall(
                  this.coloredBalls[ball.color].x,
                  this.coloredBalls[ball.color].y,
                  ball.color,
                  ball.value
                );
              } else {
                target = "Red Ball";
              }
              if (this.balls.red.length == 0 && this.balls.color.length == 0) {
                won = true;
              }
              this.redBallIn = false;
            }
            scoreBoard.addScore(this.foul ? 0 : ball.value);
          }
        }
      }
    
      // Handle cue ball falling into a pocket
      if (
        cue.ball &&
        (cue.ball.position.y <= 106 || cue.ball.position.y >= 494)
      ) {
        World.remove(engine.world, cue.ball); // Remove cue ball from the world
        cue.ball = null; // Set cue ball to null
        gameStart = false; // Set game start to false to allow repositioning
      }
    };
    
  
    const removeBall = (array, index) => {
      World.remove(engine.world, [array[index].object]);
      array.splice(index, 1);
    };
  
    this.detectCollision = (cue) => {
      for (balltype in this.balls) {
        for (ball of this.balls[balltype]) {
          if (Collision.collides(cue, ball.object)) {
            if (ball.color == "red") {
              redBallCollided();
            } else {
              coloredBallsCollided();
            }
            target = "Red ball";
          }
        }
      }
    };
  
    this.drawFoul = () => {
      push();
      textSize(24);
      stroke(this.foul ? "red" : 0);
      fill(this.foul ? "red" : 0);
      text("Foul: " + this.foulMessage, 450, 700);
      pop();
    };
  
    const redBallCollided = () => {
      if ((this.redBallIn || ballCollided == "color") && !this.foul) {
        this.foul = true;
        this.foulMessage = "Red ball Hit";
        scoreBoard.addScore(-4);
      }
      this.redBallIn = false;
      ballCollided = "red";
    };
  
    const coloredBallsCollided = () => {
      if (!this.redBallIn && this.balls.red.length != 0 && !this.foul) {
        this.foul = true;
        this.foulMessage = "Coloured ball Hit";
        scoreBoard.addScore(-4);
      }
      this.redBallIn = false;
      ballCollided = "color";
    };
  
    this.newTurn = () => {
      this.foul = false;
      this.foulMessage = "";
      ballCollided = "";
      consecColor = 0;
      this.setBallsSleep(true);
    };
  
    this.checkWin = () => {
      if (won) {
        push();
        textSize(40);
        stroke(won ? "green" : 0);
        fill(won ? "green" : 0);
        text("You Win!", 400, 700);
        pop();
        setTimeout(() => {
          noLoop();
        }, 1000);
      }
    };
  
    this.showTarget = () => {
      push();
      textSize(20);
      stroke(255);
      fill("white");
      text("Target: " + target, 900, 50);
      pop();
    };
  
    // Randomizes the position of all balls within a specified range
  this.randomizeAllBallPositions = () => {
    for (let ballType in this.balls) {
      for (let ball of this.balls[ballType]) {
        let randomX = random(250, 950); // Random x-coordinate within the range
        let randomY = random(150, 400); // Random y-coordinate within the range
        Matter.Body.setPosition(ball.object, { x: randomX, y: randomY });
        Sleeping.set(ball.object, false); // Wake up the ball to allow repositioning
      }
    }
  };
  
  // Randomize the position of only red balls
  this.randomizeRedBallPositions = () => {
    for (let ball of this.balls.red) {
      let randomX = random(250, 950); // Random x-coordinate within the range
      let randomY = random(150, 400); // Random y-coordinate within the range
      Matter.Body.setPosition(ball.object, { x: randomX, y: randomY });
      Sleeping.set(ball.object, false); // Wake up the ball to allow repositioning
    }
  };
  
  // Add a key press listener for the "3" key (randomize all balls)
  document.addEventListener("keydown", (event) => {
    if (event.key === "3") {
      this.randomizeAllBallPositions();
    }
  });
  
  // Add a key press listener for the "2" key (randomize only red balls)
  document.addEventListener("keydown", (event) => {
    if (event.key === "2") {
      this.randomizeRedBallPositions();
    }
  });
  
  }
  
  
  
  
  // ----------------------- Function for cue ball -----------------------
  function CueBall() {
    this.ball;
  
    // Creates the ball object
    this.setUpCueBall = (x, y) => {
      this.ball = Bodies.circle(x, y, ballRadius, {
        friction: 0.9,
        restitution: 0.5,
        density: 0.005,
      });
      Body.setMass(this.ball, (this.ball.mass *= 2));
      World.add(engine.world, [this.ball]);
    };
  
    // Draws the cue ball
    this.draw = () => {
      push();
      fill("white");
      hp.drawVertices(this.ball.vertices);
      stroke(0);
      strokeWeight(3);
      pop();
    };
  
    // Checks whether the cue ball is moving, returns boolean
    this.notMoving = () => {
      if (!this.ball) return false;
      return (
        Math.abs(this.ball.velocity.x) <= 0.05 &&
        Math.abs(this.ball.velocity.y) <= 0.05
      );
    };
  
    // Checks whether the cue ball is within the field boundaries, returns boolean
    this.inField = () => {
      return (
        this.ball.position.x >= 200 &&
        this.ball.position.x <= 1000 &&
        this.ball.position.y >= 100 &&
        this.ball.position.y <= 500
      );
    };
  
    // Ensures the cue ball's velocity is within a reasonable limit
    this.limitVelocity = () => {
      const velocityLimit = 15;
      Body.setVelocity(this.ball, {
        x: constrain(this.ball.velocity.x, -velocityLimit, velocityLimit),
        y: constrain(this.ball.velocity.y, -velocityLimit, velocityLimit),
      });
    };
  }
  
  
  
  // ----------------------- Function for extensions -----------------------
  function Extensions() {
    //list of powers already used
    let powersUsed = [];
    //list of buttons
    let buttons = [];
    //list of powers, their names, the functions they run when activated
    //and the functions to run after its been deactivated
    this.powers = {
      ENLARGE: {
        title: "ENLARGE THE BALLS",
        activated: false,
        activate: () => {
          //iterates through balls array
          for (type in ballManager.balls) {
            for (ball of ballManager.balls[type]) {
              //makes all balls 50% BIGGER
              Body.scale(ball.object, 1.5, 1.5);
            }
          }
        },
        deactivate: () => {
          for (type in ballManager.balls) {
            for (ball of ballManager.balls[type]) {
              //resets the area back to normal, if the area is smaller than starting
              if (ball.object.area < 91) {
                Body.scale(ball.object, 2 / 3, 2 / 3);
              }
            }
          }
        },
      },
      points: {
        title: "DOUBLE POINTS",
        activated: false,
        activate: () => {
          //iterates through all balls and doubles their values
          for (type in ballManager.balls) {
            for (ball of ballManager.balls[type]) {
              ball.value *= 2;
            }
          }
        },
        deactivate: () => {
          //resets the points of all balls,
          for (type in ballManager.balls) {
            for (ball of ballManager.balls[type]) {
              //except colored balls that returns after being pocketed
              if (
                ball.color == "red" ||
                ball.value != ballManager.coloredBalls[ball.color].value
              ) {
                ball.value *= 1 / 2;
              }
            }
          }
        },
      },
      align: {
        title: "LINE 'EM UP",
        activated: false,
        activate: () => {
          //array of objects that contain the x y coordinates of the balls
          let positions = [
            { x: 220, y: 120 },
            { x: 600, y: 120 },
            { x: 980, y: 120 },
            { x: 220, y: 480 },
            { x: 600, y: 480 },
            { x: 980, y: 480 },
          ];
          //counter to only have 6 balls for the 6 pockets be moved
          let counter = 0;
          for (type in ballManager.balls) {
            for (ball of ballManager.balls[type]) {
              //randomly assigns balls based on a 70% and 50% probability for the red
              //and color respectively
              if (random() > (ball.color == "red" ? 0.7 : 0.5) && counter < 6) {
                let vector = positions[counter];
                Body.setPosition(ball.object, { x: vector.x, y: vector.y });
                counter++;
              }
            }
          }
        },
        deactivate: () => {
          return false;
        },
      },
    };
    //function that makes the button and its functionality
    const makeButton = (power, y) => {
      const button = createButton(power.title);
      //add button to the button array
      buttons.push(button);
      //places the button 
      button.position(25, y);
      //if the power has been used, deactivate the button
      if (powersUsed.includes(power)) {
        button.attribute("disabled", true);
      }
      //give onclick event listener to button
      button.mousePressed(function () {
        power.activate();
        power.activated = true;
        button.attribute("disabled", true);
        powersUsed.push(power);
      });
    };
  
    //functions that places the button on the screen
    this.placeButtons = () => {
      let y = 200;
      //hides the previously created buttons to avoid weird visual overlap effect
      for (button of buttons) {
        button.hide();
      }
      for (power in this.powers) {
        y += 50;
        makeButton(this.powers[power], y);
      }
    };
    //deactivates the powers
    this.deactivate = () => {
      for (power in this.powers) {
        //run the deactivate function of the power that is activated
        if (this.powers[power].activated) {
          this.powers[power].deactivate();
          this.powers[power].activated = false;
        }
      }
    };
  }
  
  
  // ----------------------- Function for helper -----------------------
  function Helper() {
    this.drawVertices = (vertices) => {
      beginShape();
      for (let i = 0; i < vertices.length; i++) {
        vertex(vertices[i].x, vertices[i].y);
      }
      endShape(CLOSE);
    };
  
    this.setupMouseInteraction = () => {
      //sets up the mouse interaction with the cue ball
      const mouse = Mouse.create(canvas.elt);
      const mouseParams = {
        mouse: mouse,
        constraint: { stiffness: 0.05 },
      };
      mouseConstraint = MouseConstraint.create(engine, mouseParams);
      //disables mouse interaction with the other balls
      mouseConstraint.mouse.pixelRatio = pixelDensity();
      mouseConstraint.collisionFilter.mask = 0x0001;
      World.add(engine.world, mouseConstraint);
    };
  }
  
  // ----------------------- Function for scoreboard -----------------------
  function ScoreBoard() {
    let score = 0;
    //adds the score
    this.addScore = (s) => {
      score += s;
    };
  
    //shows the scoreboard
    this.showScore = () => {
      push();
      textSize(24);
      fill("white");
      stroke("white");
      text("Score: " + score, 1050, 400);
    };
  }
  
  
  // ----------------------- Function for table -----------------------
  function Table() {
    let cushions = [];
    const tableWidth = 800;
    const tableLength = tableWidth / 2;
    const boxWidth = (tableWidth / 72) * 1.5;
    const cushionHeight = 10
    const cushionAngle = 0.05
    //creates the cushions as a trapezoid
    this.createCushions = () => {
      cushions.push(
        Bodies.trapezoid(402, 105, tableLength - boxWidth * 2 - 13, cushionHeight, -0.07, {
          isStatic: true,
          restitution: 1,
        })
      );
      cushions.push(
        Bodies.trapezoid(800, 105, tableLength - boxWidth * 2 - 10, cushionHeight, -cushionAngle, {
          isStatic: true,
          restitution: 1,
        })
      );
      cushions.push(
        Bodies.trapezoid(205, 300, tableLength - boxWidth * 2 + 9, cushionHeight, cushionAngle, {
          isStatic: true,
          angle: Math.PI / 2,
          restitution: 1,
        })
      );
      cushions.push(
        Bodies.trapezoid(403, 495, tableLength - boxWidth * 2 + 9, cushionHeight, cushionAngle, {
          isStatic: true,
          restitution: 1,
        })
      );
      cushions.push(
        Bodies.trapezoid(797, 495, tableLength - boxWidth * 2 + 12, cushionHeight, cushionAngle, {
          isStatic: true,
          restitution: 1,
        })
      );
      cushions.push(
        Bodies.trapezoid(995, 300, tableLength - boxWidth * 2 - 12, cushionHeight, -cushionAngle, {
          isStatic: true,
          angle: Math.PI / 2,
          restitution: 1,
        })
      );
      //adds the cushions to the world
      for (cushion of cushions) {
        World.add(engine.world, [cushion]);
      }
      // adds hard barriers to ensure balls do not fly out of the pool table
      this.createHardBarriers = () => {
        const barrierThickness = 20; // Thickness of the barriers
        const tableLeft = 200; // Left edge of the table
        const tableRight = 1000; // Right edge of the table
        const tableTop = 100; // Top edge of the table
        const tableBottom = 500; // Bottom edge of the table
      
        // Define barriers (rectangles) at the edges of the table
        const barriers = [
          Bodies.rectangle((tableLeft + tableRight) / 2, tableTop - barrierThickness / 2, tableWidth, barrierThickness, { isStatic: true }),
          Bodies.rectangle((tableLeft + tableRight) / 2, tableBottom + barrierThickness / 2, tableWidth, barrierThickness, { isStatic: true }),
          Bodies.rectangle(tableLeft - barrierThickness / 2, (tableTop + tableBottom) / 2, barrierThickness, tableLength, { isStatic: true }),
          Bodies.rectangle(tableRight + barrierThickness / 2, (tableTop + tableBottom) / 2, barrierThickness, tableLength, { isStatic: true }),
        ];
      
        // Add the barriers to the world
        for (let barrier of barriers) {
          World.add(engine.world, [barrier]);
        }
      };      
    };
  
    const drawPlayingField = () => {
      noStroke();
      //playing field
      fill("#4e8834");
      rect(200, 100, tableWidth, tableLength);
    };
  
    const drawRailing = () => {
      fill("#40230d");
      //left
      rect(185, 100, 15, tableLength);
    
      //top
      rect(200, 85, tableWidth, 15);
     
      //right
      rect(1000, 100, 15, tableLength);
  
      //bottom
      rect(200, 500, tableWidth, 15);
  
    };
  
    const drawYellowBoxes = () => {
      fill("#f1d74a");
      //top left
      rect(185, 85, 25, 25, 15, 0, 0, 0);
      //top mid
      rect(588, 85, 24, 15);
      //top right
      rect(990, 85, 25, 25, 0, 15, 0, 0);
      //bottom left
      rect(185, 490, 25, 25, 0, 0, 0, 15);
      //bottom mid
      rect(588, 500, 24, 15);
      //bottom right
      rect(990, 490, 25, 25, 0, 0, 15, 0);
    };
  
    const drawHoles = () => {
      fill(0);
      //top left
      ellipse(205, 104, boxWidth);
      //top mid
      ellipse(600, 104, boxWidth);
      //top right
      ellipse(996, 104, boxWidth);
      //bottom left
      ellipse(205, 495, boxWidth);
      //bottom mid
      ellipse(600, 495, boxWidth);
      //bottom right
      ellipse(996, 495, boxWidth);
    };
  
    const drawDLine = () => {
      fill(255);
      stroke(255);
      line(
        200 + tableWidth / 5,
        100 + 15,
        200 + tableWidth / 5,
        tableLength + 100 - 15
      );
      noFill();
      arc(200 + tableWidth / 5, 175 + 370 / 3, 150, 150, 90, 270);
    };
  
    this.detectCollision = (cue) => {
      //changes the render of the cushion when colliding with the cue ball
      for (cushion of cushions){
          if(Collision.collides(cue, cushion)){
            cushion.render.visible = false;
          }
          else{
            cushion.render.visible = true;
          }
      }
    }
  
    const drawCushions = (c) => {
      for (cushion of c) {
        push();
        noStroke();
        //changes the fill between dark n light green, depending on render visibility
        fill(cushion.render.visible ? "#346219":"#69F319");
        hp.drawVertices(cushion.vertices);
        pop();
      }
    };
    this.draw = function () {
      drawPlayingField();
      drawRailing();
      drawYellowBoxes();
      drawHoles();
      drawDLine();
      drawCushions(cushions);
    };
  }
  
  
  // ----------------------- Function for timer -----------------------
  function Timer() {
    let minutes = 10;
    let seconds = 0;
    this.startTimer = () => {
      //60 frames per second so runs this func one every second
      if (frameCount % 60 == 0) {
        if (minutes == 0 && seconds == 0) {
          minutes = 0;
          seconds = 0;
          //kills the loop when time is over
          noLoop();
        } else if (seconds == 0) {
          minutes -= 1;
          seconds = 60;
        }
        seconds -= 1;
      }
    };
    //draws the timer
    this.drawTimer = () => {
      push();
      textSize(18);
      fill("white");
      stroke(255);
      //adds a "0" before the minutes and seconds if they're less than 10
      if (minutes + seconds != 0) {
        text(
          `Time left: ${minutes < 10 ? "0" + minutes : minutes}:${
            seconds < 10 ? "0" + seconds : seconds
          }`,
          1050,
          200
        );
      } else {
        text("TIME'S UP!", 1050, 200);
      }
  
      pop();
    };
  }
  
  