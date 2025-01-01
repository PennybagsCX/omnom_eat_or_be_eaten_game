import pygame
import random
import numpy as np

# Initialize Pygame
pygame.init()

# Screen Dimensions
WIDTH, HEIGHT = 800, 600
GRID_SIZE = 20
GRID_WIDTH = WIDTH // GRID_SIZE
GRID_HEIGHT = HEIGHT // GRID_SIZE

# Colors
BLACK = (0, 0, 0)
WHITE = (255, 255, 255)
GREEN = (0, 255, 0)
RED = (255, 0, 0)
SHIBA_BROWN = (210, 180, 140)

# Game Screen
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("$OMNOM: Shiba Crypto Takeover 🐶💸")

class ShibaGame:
    def __init__(self):
        self.shiba_pos = [GRID_WIDTH // 2, GRID_HEIGHT // 2]
        self.shiba_body = [self.shiba_pos.copy()]
        self.direction = [1, 0]
        self.score = 0
        self.dogs = self.generate_dogs()
        self.font = pygame.font.Font(None, 36)

    def generate_dogs(self):
        dogs = []
        for _ in range(5):
            dog = [random.randint(0, GRID_WIDTH-1), random.randint(0, GRID_HEIGHT-1)]
            while dog in self.shiba_body or dog in dogs:
                dog = [random.randint(0, GRID_WIDTH-1), random.randint(0, GRID_HEIGHT-1)]
            dogs.append(dog)
        return dogs

    def move(self):
        new_head = [
            self.shiba_pos[0] + self.direction[0],
            self.shiba_pos[1] + self.direction[1]
        ]
        
        # Wall collision
        if (new_head[0] < 0 or new_head[0] >= GRID_WIDTH or 
            new_head[1] < 0 or new_head[1] >= GRID_HEIGHT):
            return False
        
        # Self collision
        if new_head in self.shiba_body[:-1]:
            return False
        
        self.shiba_pos = new_head
        self.shiba_body.insert(0, new_head.copy())
        
        # Eating dogs
        for dog in self.dogs[:]:
            if self.shiba_pos == dog:
                self.score += 1
                self.dogs.remove(dog)
                self.dogs.extend(self.generate_dogs())
                break
        else:
            self.shiba_body.pop()
        
        return True

    def draw(self):
        screen.fill(BLACK)
        
        # Draw Shiba body
        for segment in self.shiba_body:
            pygame.draw.rect(screen, SHIBA_BROWN, 
                             (segment[0]*GRID_SIZE, segment[1]*GRID_SIZE, 
                              GRID_SIZE, GRID_SIZE))
        
        # Draw dogs
        for dog in self.dogs:
            pygame.draw.rect(screen, RED, 
                             (dog[0]*GRID_SIZE, dog[1]*GRID_SIZE, 
                              GRID_SIZE, GRID_SIZE))
        
        # Draw score
        score_text = self.font.render(f'$OMNOM: {self.score}', True, WHITE)
        screen.blit(score_text, (10, 10))
        
        pygame.display.flip()

def main():
    clock = pygame.time.Clock()
    game = ShibaGame()
    running = True

    while running:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            
            if event.type == pygame.KEYDOWN:
                if event.key == pygame.K_UP and game.direction != [0, 1]:
                    game.direction = [0, -1]
                elif event.key == pygame.K_DOWN and game.direction != [0, -1]:
                    game.direction = [0, 1]
                elif event.key == pygame.K_LEFT and game.direction != [1, 0]:
                    game.direction = [-1, 0]
                elif event.key == pygame.K_RIGHT and game.direction != [-1, 0]:
                    game.direction = [1, 0]
        
        if not game.move():
            running = False
        
        game.draw()
        clock.tick(10)  # Game speed
    
    # Game over screen
    screen.fill(BLACK)
    game_over = pygame.font.Font(None, 74).render('GAME OVER', True, WHITE)
    final_score = pygame.font.Font(None, 50).render(f'$OMNOM Tokens: {game.score}', True, GREEN)
    screen.blit(game_over, (WIDTH//2 - game_over.get_width()//2, HEIGHT//2 - 50))
    screen.blit(final_score, (WIDTH//2 - final_score.get_width()//2, HEIGHT//2 + 50))
    pygame.display.flip()
    
    pygame.time.wait(3000)
    pygame.quit()

if __name__ == "__main__":
    main()
