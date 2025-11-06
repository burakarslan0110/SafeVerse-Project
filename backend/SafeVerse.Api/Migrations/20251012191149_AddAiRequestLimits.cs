using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SafeVerse.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddAiRequestLimits : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "AiRequestsResetAt",
                table: "Users",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "DailyAiRequestsRemaining",
                table: "Users",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AiRequestsResetAt",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "DailyAiRequestsRemaining",
                table: "Users");
        }
    }
}
