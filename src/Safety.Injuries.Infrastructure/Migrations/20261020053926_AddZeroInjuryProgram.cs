using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Safety.Injuries.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddZeroInjuryProgram : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<uint>(
                name: "xmin",
                table: "Injuries",
                type: "xid",
                rowVersion: true,
                nullable: false,
                defaultValue: 0u);

            migrationBuilder.CreateTable(
                name: "ZeroInjuryPrograms",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    StartDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    TriggeringInjuryId = table.Column<Guid>(type: "uuid", nullable: true),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    TargetDaysInternal = table.Column<int>(type: "integer", nullable: false),
                    SetByUserId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    SetByUserName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    IsFinalized = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    IsSuccessfullyCompleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    InterruptingInjuryId = table.Column<Guid>(type: "uuid", nullable: true),
                    FinalizedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ZeroInjuryPrograms", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ZeroInjuryPrograms_Injuries_TriggeringInjuryId",
                        column: x => x.TriggeringInjuryId,
                        principalTable: "Injuries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "ZeroInjuryDocuments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ProgramId = table.Column<Guid>(type: "uuid", nullable: false),
                    FileName = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    ContentType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Size = table.Column<long>(type: "bigint", nullable: false),
                    Data = table.Column<byte[]>(type: "bytea", nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    DocumentType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ZeroInjuryDocuments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ZeroInjuryDocuments_ZeroInjuryPrograms_ProgramId",
                        column: x => x.ProgramId,
                        principalTable: "ZeroInjuryPrograms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Injuries_Category",
                table: "Injuries",
                column: "Category");

            migrationBuilder.CreateIndex(
                name: "IX_Injuries_Date",
                table: "Injuries",
                column: "Date");

            migrationBuilder.CreateIndex(
                name: "IX_ZeroInjuryDocuments_ProgramId",
                table: "ZeroInjuryDocuments",
                column: "ProgramId");

            migrationBuilder.CreateIndex(
                name: "IX_ZeroInjuryPrograms_IsFinalized",
                table: "ZeroInjuryPrograms",
                column: "IsFinalized");

            migrationBuilder.CreateIndex(
                name: "IX_ZeroInjuryPrograms_StartDate",
                table: "ZeroInjuryPrograms",
                column: "StartDate");

            migrationBuilder.CreateIndex(
                name: "IX_ZeroInjuryPrograms_TriggeringInjuryId",
                table: "ZeroInjuryPrograms",
                column: "TriggeringInjuryId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ZeroInjuryDocuments");

            migrationBuilder.DropTable(
                name: "ZeroInjuryPrograms");

            migrationBuilder.DropIndex(
                name: "IX_Injuries_Category",
                table: "Injuries");

            migrationBuilder.DropIndex(
                name: "IX_Injuries_Date",
                table: "Injuries");

            migrationBuilder.DropColumn(
                name: "xmin",
                table: "Injuries");
        }
    }
}
